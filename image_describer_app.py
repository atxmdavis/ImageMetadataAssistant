#!/usr/bin/env python3
"""Desktop image metadata generator.

Select a folder of images, run computer vision analysis on each file, and
write generated metadata into the image itself.
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import math
import multiprocessing as mp
import re
import struct
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import piexif
from PIL import Image, ImageFilter, PngImagePlugin
from transformers import pipeline

try:
    import tkinter as tk
    from tkinter import filedialog
except Exception:  # pragma: no cover
    tk = None
    filedialog = None

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}
DEFAULT_CAPTION_MODEL = "Salesforce/blip-image-captioning-base"
DEFAULT_DETECTOR_MODEL = "google/owlvit-base-patch32"
DETECTOR_DISABLED_MODEL = "none"
SUPPORTED_CAPTION_MODELS = {
    DEFAULT_CAPTION_MODEL,
    "Salesforce/blip-image-captioning-large",
}
SUPPORTED_DETECTOR_MODELS = {
    DEFAULT_DETECTOR_MODEL,
    "google/owlvit-large-patch14",
    DETECTOR_DISABLED_MODEL,
}
PNG_METADATA_JSON_KEY = "ImageDescriberMetadata"
PNG_METADATA_DESCRIPTION_KEY = "Description"
PNG_METADATA_SUBJECT_KEY = "Subject"
PNG_METADATA_KEYWORDS_KEY = "Keywords"
PNG_METADATA_COMMENT_KEY = "Comment"
PNG_METADATA_OBJECTS_KEY = "Objects"
PNG_METADATA_ACTIONS_KEY = "Actions"
PNG_METADATA_COLORS_KEY = "Colors"
PNG_METADATA_CUSTOM_TAGS_KEY = "CustomTags"
PNG_METADATA_CATEGORIES_KEY = "Categories"
PNG_METADATA_IP_RISK_KEY = "IPRisk"
PNG_METADATA_XMP_KEY = "XML:com.adobe.xmp"
XMP_JPEG_APP1_IDENTIFIER = b"http://ns.adobe.com/xap/1.0/\x00"
CLI_CHECKPOINT_STATE_FILENAME = ".image_describer_cli_checkpoint.json"
CLI_CHECKPOINT_DONE_FILENAME = ".image_describer_cli_checkpoint.done"

EXIF_TAG_XP_TITLE = int(getattr(piexif.ImageIFD, "XPTitle", 40091))
EXIF_TAG_XP_COMMENT = int(getattr(piexif.ImageIFD, "XPComment", 40092))
EXIF_TAG_XP_KEYWORDS = int(getattr(piexif.ImageIFD, "XPKeywords", 40094))
EXIF_TAG_XP_SUBJECT = int(getattr(piexif.ImageIFD, "XPSubject", 40095))
MANAGED_PNG_TEXT_KEYS = {
    PNG_METADATA_JSON_KEY,
    PNG_METADATA_DESCRIPTION_KEY,
    PNG_METADATA_SUBJECT_KEY,
    PNG_METADATA_KEYWORDS_KEY,
    PNG_METADATA_COMMENT_KEY,
    PNG_METADATA_OBJECTS_KEY,
    PNG_METADATA_ACTIONS_KEY,
    PNG_METADATA_COLORS_KEY,
    PNG_METADATA_CUSTOM_TAGS_KEY,
    PNG_METADATA_CATEGORIES_KEY,
    PNG_METADATA_IP_RISK_KEY,
    PNG_METADATA_XMP_KEY,
}
MANAGED_EXIF_ZERO_TAGS = {
    piexif.ImageIFD.ImageDescription,
    EXIF_TAG_XP_TITLE,
    EXIF_TAG_XP_SUBJECT,
    EXIF_TAG_XP_KEYWORDS,
    EXIF_TAG_XP_COMMENT,
}
MANAGED_EXIF_EXIF_TAGS = {
    piexif.ExifIFD.UserComment,
}

BASE_OBJECT_CANDIDATES = [
    "person",
    "man",
    "woman",
    "child",
    "face",
    "animal",
    "dog",
    "cat",
    "bird",
    "horse",
    "cow",
    "sheep",
    "elephant",
    "car",
    "truck",
    "bus",
    "bicycle",
    "motorcycle",
    "airplane",
    "boat",
    "train",
    "crane",
    "construction crane",
    "construction site",
    "scaffolding",
    "tree",
    "flower",
    "plant",
    "mushroom",
    "fungus",
    "toadstool",
    "forest",
    "tree trunk",
    "branch",
    "grass",
    "building",
    "house",
    "road",
    "street",
    "sky",
    "cloud",
    "water",
    "river",
    "lake",
    "ocean",
    "mountain",
    "beach",
    "food",
    "table",
    "chair",
    "sofa",
    "bed",
    "lamp",
    "computer",
    "laptop",
    "phone",
    "cell phone",
    "smartphone",
    "purse",
    "handbag",
    "bag",
    "book",
    "bottle",
    "cup",
    "pipe",
    "cannabis",
    "cannabis flower",
    "clock",
    "backpack",
    "suitcase",
    "toilet",
    "tv",
    "window",
    "door",
    "stairs",
    "tower",
    "castle",
    "fortress",
    "gate",
    "path",
    "moon",
    "sun",
    "fire",
    "lantern",
    "pumpkin",
    "jack-o-lantern",
    "grim reaper",
    "reaper",
    "skeleton warrior",
    "hood",
    "cloak",
    "robe",
    "staff",
    "scythe",
    "sword",
    "picture frame",
    "mirror",
    "wall",
    "light switch",
    "switch plate",
    "skull",
    "skeleton",
    "bone",
    "sculpture",
    "statue",
    "mask",
]

COCO_OBJECT_PROMPTS = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "airplane",
    "bus",
    "train",
    "truck",
    "boat",
    "traffic light",
    "fire hydrant",
    "stop sign",
    "parking meter",
    "bench",
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    "backpack",
    "umbrella",
    "handbag",
    "tie",
    "suitcase",
    "frisbee",
    "skis",
    "snowboard",
    "sports ball",
    "kite",
    "baseball bat",
    "baseball glove",
    "skateboard",
    "surfboard",
    "tennis racket",
    "bottle",
    "wine glass",
    "cup",
    "fork",
    "knife",
    "spoon",
    "bowl",
    "banana",
    "apple",
    "sandwich",
    "orange",
    "broccoli",
    "carrot",
    "hot dog",
    "pizza",
    "donut",
    "cake",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "dining table",
    "toilet",
    "tv",
    "laptop",
    "mouse",
    "remote",
    "keyboard",
    "cell phone",
    "microwave",
    "oven",
    "toaster",
    "sink",
    "refrigerator",
    "book",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
    "hair drier",
    "toothbrush",
]

GENERAL_OBJECT_PROMPTS = [
    "construction crane",
    "tower crane",
    "construction site",
    "scaffolding",
    "excavator",
    "bulldozer",
    "helmet",
    "mushroom",
    "toadstool",
    "forest",
    "tree trunk",
    "branch",
    "castle",
    "fortress",
    "lantern",
    "jack-o-lantern",
    "skull",
    "skeleton",
    "mask",
    "phone",
    "smartphone",
    "purse",
    "handbag",
    "bag",
    "pipe",
    "cannabis",
    "cannabis flower",
]

OBJECT_PROMPT_LIBRARY = list(dict.fromkeys(COCO_OBJECT_PROMPTS + BASE_OBJECT_CANDIDATES + GENERAL_OBJECT_PROMPTS))

GENERIC_OBJECT_LABELS = {
    "object",
    "item",
    "thing",
    "art",
    "person",
    "man",
    "woman",
    "child",
    "figure",
    "sculpture",
    "statue",
    "animal",
}

PREFERRED_SCENE_LABELS = {
    "grim reaper",
    "skeleton",
    "skull",
    "scythe",
    "castle",
    "tower",
    "jack-o-lantern",
    "pumpkin",
    "lantern",
    "mushroom",
    "toadstool",
    "crane",
    "construction crane",
    "construction site",
    "phone",
    "purse",
}

CAPTION_STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "in",
    "on",
    "at",
    "of",
    "to",
    "with",
    "for",
    "from",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "being",
    "been",
    "this",
    "that",
    "these",
    "those",
    "there",
    "here",
    "inside",
    "outside",
    "near",
    "next",
    "front",
    "back",
    "close",
    "up",
    "down",
    "left",
    "right",
    "image",
    "photo",
    "picture",
    "scene",
    "view",
    "background",
}

CAPTION_TYPO_CORRECTIONS = {
    "sombrel": "sombrero",
    "sombero": "sombrero",
    "sombrer": "sombrero",
    "sombrerro": "sombrero",
    "chiwawa": "chihuahua",
    "chiwahua": "chihuahua",
    "chiwahuah": "chihuahua",
    "cihuahua": "chihuahua",
    "cellfone": "cell phone",
    "jackolantern": "jack-o-lantern",
    "jackolatern": "jack-o-lantern",
    "marihuana": "marijuana",
    "watercolour": "watercolor",
    "impressionism": "impressionist",
    "surrealistm": "surrealism",
    "cyberpnk": "cyberpunk",
    "steampnk": "steampunk",
    "ghiblii": "ghibli",
    "pixarrr": "pixar",
    "pokmon": "pokemon",
    "pikacu": "pikachu",
    "spideman": "spider-man",
    "spiderman": "spider-man",
    "batmn": "batman",
    "deadpol": "deadpool",
    "mariio": "mario",
    "sonik": "sonic",
    "banda": "bandana",
    "bandna": "bandana",
    "bandanna": "bandana",
    "hello-kity": "hello kitty",
    "starwar": "star wars",
    "starwars": "star wars",
    "stormtroper": "stormtrooper",
    "dartvader": "darth vader",
    "darh": "darth",
    "xenomorh": "xenomorph",
    "xenamorph": "xenomorph",
    "xenomrph": "xenomorph",
    "face hugger": "facehugger",
    "harrypotter": "harry potter",
    "harry poter": "harry potter",
    "harry pottter": "harry potter",
    "hogwarts": "hogwarts",
    "pokeman": "pokemon",
    "pokimon": "pokemon",
    "mariobros": "super mario bros",
    "mario brothers": "super mario bros",
    "jamesbond": "james bond",
    "jame bond": "james bond",
    "007 agent": "007",
    "totorro": "totoro",
    "leggo": "lego",
}

CAPTION_DOMAIN_TERMS = {
    "anime",
    "manga",
    "watercolor",
    "impressionist",
    "surrealism",
    "cyberpunk",
    "steampunk",
    "ghibli",
    "pixar",
    "disney",
    "marvel",
    "dc",
    "pokemon",
    "pikachu",
    "mario",
    "sonic",
    "batman",
    "superman",
    "deadpool",
    "spider-man",
    "stormtrooper",
    "darth",
    "vader",
    "xenomorph",
    "facehugger",
    "chestburster",
    "weyland",
    "yutani",
    "ripley",
    "nostromo",
    "totoro",
    "lego",
    "hello",
    "kitty",
    "star",
    "wars",
    "avengers",
    "spider",
    "spiderman",
    "iron",
    "thor",
    "hulk",
    "thanos",
    "wolverine",
    "disneyland",
    "mickey",
    "minnie",
    "donald",
    "goofy",
    "pixar",
    "elsa",
    "anna",
    "moana",
    "simba",
    "nintendo",
    "zelda",
    "hyrule",
    "bowser",
    "yoshi",
    "kirby",
    "samus",
    "metroid",
    "gameboy",
    "harry",
    "potter",
    "hogwarts",
    "gryffindor",
    "slytherin",
    "ravenclaw",
    "hufflepuff",
    "pokemon",
    "pokeball",
    "pokémon",
    "mario",
    "bros",
    "goomba",
    "koopa",
    "james",
    "bond",
    "007",
    "mi6",
    "superman",
    "joker",
    "harley",
    "aquaman",
    "flash",
    "lantern",
    "wayne",
    "kent",
}

IP_RISK_ENTITY_TERMS: dict[str, set[str]] = {
    "disney": {
        "disney",
        "walt disney",
        "disneyland",
        "disney castle",
        "mickey",
        "mickey mouse",
        "mickeymouse",
        "minnie",
        "minnie mouse",
        "donald duck",
        "goofy",
        "pluto",
        "daisy duck",
        "pixar",
        "toy story",
        "woody",
        "buzz lightyear",
        "frozen",
        "elsa",
        "anna",
        "olaf",
        "moana",
        "stitch",
        "lilo and stitch",
        "lion king",
        "simba",
        "disney princess",
    },
    "marvel": {
        "marvel",
        "marvel comics",
        "avengers",
        "iron man",
        "tony stark",
        "captain america",
        "steve rogers",
        "thor",
        "hulk",
        "bruce banner",
        "black widow",
        "hawkeye",
        "spider-man",
        "spiderman",
        "peter parker",
        "venom",
        "doctor strange",
        "scarlet witch",
        "black panther",
        "wakanda",
        "deadpool",
        "wolverine",
        "x-men",
        "thanos",
        "guardians of the galaxy",
        "groot",
    },
    "dc comics": {
        "dc",
        "dc comics",
        "justice league",
        "batman",
        "bruce wayne",
        "superman",
        "clark kent",
        "wonder woman",
        "diana prince",
        "joker",
        "harley quinn",
        "the flash",
        "flash",
        "barry allen",
        "aquaman",
        "green lantern",
        "cyborg",
        "shazam",
        "catwoman",
        "gotham",
        "kryptonite",
    },
    "star wars": {
        "star wars",
        "starwar",
        "starwars",
        "stormtrooper",
        "storm trooper",
        "darth vader",
        "darthvader",
        "darth",
        "vader",
        "anakin skywalker",
        "luke skywalker",
        "obi-wan",
        "lightsaber",
        "jedi",
        "sith",
    },
    "harry potter": {
        "harry potter",
        "harrypotter",
        "hogwarts",
        "gryffindor",
        "hufflepuff",
        "slytherin",
        "ravenclaw",
        "hagrid",
        "dumbledore",
        "hermione",
        "ron weasley",
        "voldemort",
        "snape",
        "quidditch",
        "deathly hallows",
        "platform 9 3/4",
    },
    "alien franchise": {
        "xenomorph",
        "xenomorph drone",
        "xenomorph queen",
        "facehugger",
        "chestburster",
        "alien queen",
        "weyland yutani",
        "weyland-yutani",
        "nostromo",
        "ellen ripley",
        "ripley",
        "lv-426",
    },
    "pokemon": {
        "pokemon",
        "pokémon",
        "pokeball",
        "poke ball",
        "pikachu",
        "charizard",
        "bulbasaur",
        "squirtle",
        "eevee",
        "snorlax",
        "jigglypuff",
        "mewtwo",
        "ash ketchum",
        "team rocket",
    },
    "super mario bros": {
        "super mario bros",
        "super mario",
        "mario bros",
        "mario brothers",
        "mario",
        "luigi",
        "princess peach",
        "toad",
        "yoshi",
        "bowser",
        "goomba",
        "koopa",
        "mushroom kingdom",
    },
    "nintendo": {
        "nintendo",
        "nintendo switch",
        "super mario",
        "mario",
        "mario kart",
        "luigi",
        "princess peach",
        "bowser",
        "yoshi",
        "toad",
        "donkey kong",
        "zelda",
        "legend of zelda",
        "link",
        "hyrule",
        "triforce",
        "kirby",
        "metroid",
        "samus",
        "animal crossing",
        "pikmin",
        "gameboy",
    },
    "e.t.": {
        "e.t.",
        "et",
        "e t",
        "e.t",
        "extra-terrestrial",
        "extraterrestrial",
        "et phone home",
        "phone home",
        "elliott",
    },
    "james bond": {
        "james bond",
        "007",
        "agent 007",
        "mi6",
        "ian fleming",
        "aston martin",
        "bond girl",
        "q branch",
    },
    "sonic": {"sonic", "tails", "knuckles"},
    "dragon ball": {"dragon ball", "goku", "vegeta", "super saiyan"},
    "studio ghibli": {"ghibli", "totoro", "spirited away", "howl"},
    "hello kitty": {"hello kitty", "sanrio"},
    "lego": {"lego", "minifigure", "brick figure"},
    "nike": {"nike", "swoosh"},
    "adidas": {"adidas"},
    "apple": {"apple logo"},
    "coca-cola": {"coca-cola", "coke logo"},
}

IP_RISK_CONTEXT_CLUES: dict[str, set[str]] = {
    "harry potter": {
        "hogwarts",
        "gryffindor",
        "hufflepuff",
        "slytherin",
        "ravenclaw",
        "quidditch",
        "sorting hat",
        "deathly hallows",
        "platform 9 3/4",
        "platform 9 3 4",
        "patronus",
        "death eater",
        "golden snitch",
    },
    "pokemon": {
        "pokeball",
        "poke ball",
        "pokedex",
        "pokemon trainer",
        "team rocket",
    },
    "super mario bros": {
        "mushroom kingdom",
        "goomba",
        "koopa",
        "question block",
        "warp pipe",
    },
    "james bond": {
        "007",
        "mi6",
        "aston martin",
        "q branch",
    },
}

IP_RISK_CONTEXT_MIN_HITS: dict[str, int] = {
    "harry potter": 1,
    "pokemon": 1,
    "super mario bros": 1,
    "james bond": 1,
}

IP_RISK_TEXT_NORMALIZATIONS: dict[str, str] = {
    "dart vader": "darth vader",
    "dark vader": "darth vader",
    "darh vader": "darth vader",
    "darthvader": "darth vader",
    "storm trooper": "stormtrooper",
    "starwar": "star wars",
    "starwars": "star wars",
    "micky mouse": "mickey mouse",
    "mikey mouse": "mickey mouse",
    "mickeymouse": "mickey mouse",
    "mini mouse": "minnie mouse",
    "micky": "mickey",
    "dizney": "disney",
    "marval": "marvel",
    "dccomic": "dc comics",
    "nintndo": "nintendo",
    "nintend0": "nintendo",
    "harrypotter": "harry potter",
    "hogwarts school": "hogwarts",
    "pokeman": "pokemon",
    "pokimon": "pokemon",
    "poke ball": "pokeball",
    "mario brothers": "super mario bros",
    "mariobros": "super mario bros",
    "super mario brothers": "super mario bros",
    "spiderman": "spider-man",
    "spider man": "spider-man",
    "superman logo": "superman",
    "bat man": "batman",
    "jamesbond": "james bond",
    "jame bond": "james bond",
    "agent 007": "007",
    "double o seven": "007",
    "e.t.": "et",
    "e.t": "et",
    "e t": "et",
    "extra terrestrial": "extra-terrestrial",
    "et phone home": "phone home",
    "xeno morph": "xenomorph",
    "face hugger": "facehugger",
    "weyland yutani": "weyland-yutani",
    "alien queen": "xenomorph queen",
}

IP_RISK_HINT_TERMS: set[str] = {
    "logo",
    "brand",
    "trademark",
    "copyright",
    "copyrighted",
    "character",
    "mascot",
    "fan art",
    "fanart",
    "inspired by",
    "style of",
}

IP_RISK_LEVELS = {"none", "low", "medium", "high"}

CAPTION_NON_OBJECT_TERMS = {
    "painting",
    "illustration",
    "photo",
    "photograph",
    "image",
    "picture",
    "drawing",
    "style",
    "scene",
    "view",
    "background",
    "foreground",
    "closeup",
    "close-up",
    # Grammar/function words and non-object relation words.
    "around",
    "nearby",
    "inside",
    "outside",
    "between",
    "across",
    "along",
    "through",
    "toward",
    "towards",
    "onto",
    "into",
    "upon",
    "over",
    "under",
    "above",
    "below",
    "behind",
    "beside",
    "within",
    "without",
    "its",
    "his",
    "her",
    "their",
    "our",
    "your",
    "my",
    "mine",
    "yours",
    "ours",
    "theirs",
    # Body-part descriptors (usually attributes of a subject, not standalone objects).
    "neck",
    "head",
    "face",
    "arm",
    "arms",
    "hand",
    "hands",
    "leg",
    "legs",
    "foot",
    "feet",
    "eye",
    "eyes",
    "ear",
    "ears",
    "nose",
    "mouth",
}

CAPTION_ATTRIBUTE_TERMS = {
    # Color words
    "color",
    "colors",
    "colored",
    "colorful",
    "multicolor",
    "multicolored",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "violet",
    "magenta",
    "pink",
    "brown",
    "tan",
    "beige",
    "gray",
    "grey",
    "black",
    "white",
    "gold",
    "silver",
    "teal",
    "cyan",
    "turquoise",
    "indigo",
    "maroon",
    "light",
    "dark",
    "muted",
    "bright",
    # Shape words
    "shape",
    "shapes",
    "geometric",
    "abstract",
    "circle",
    "circles",
    "circular",
    "round",
    "rounded",
    "oval",
    "ovals",
    "square",
    "squares",
    "rectangular",
    "rectangle",
    "rectangles",
    "triangle",
    "triangles",
    "triangular",
    "hexagon",
    "hexagons",
    "pentagon",
    "pentagons",
    "sphere",
    "spheres",
    "cube",
    "cubes",
    "cone",
    "cones",
    "cylinder",
    "cylinders",
    "pyramid",
    "pyramids",
    "line",
    "lines",
    "dot",
    "dots",
    "pattern",
    "patterns",
}

ACTION_PATTERNS = {
    "running": r"\brun(?:ning|s)?\b",
    "walking": r"\bwalk(?:ing|s)?\b",
    "jumping": r"\bjump(?:ing|s)?\b",
    "sitting": r"\bsit(?:ting|s)?\b",
    "standing": r"\bstand(?:ing|s)?\b",
    "eating": r"\beat(?:ing|s)?\b",
    "drinking": r"\bdrink(?:ing|s)?\b",
    "talking": r"\btalk(?:ing|s)?\b",
    "playing": r"\bplay(?:ing|s)?\b",
    "driving": r"\bdriv(?:ing|es)\b",
    "swimming": r"\bswim(?:ming|s)?\b",
    "dancing": r"\bdanc(?:ing|es)\b",
    "sleeping": r"\bsleep(?:ing|s)?\b",
    "flying": r"\bfly(?:ing|s)?\b",
    "cooking": r"\bcook(?:ing|s)?\b",
}

DEFAULT_CATEGORY_KEYWORD_RULES: dict[str, set[str]] = {
    "people": {
        "person", "people", "man", "woman", "child", "boy", "girl", "face", "portrait", "selfie",
    },
    "animals": {
        "animal", "dog", "cat", "bird", "horse", "cow", "sheep", "elephant", "duck", "chihuahua",
    },
    "wildlife": {
        "wildlife", "wild animal", "fox", "wolf", "deer", "bear", "eagle", "hawk", "owl",
        "lion", "tiger", "leopard", "panther", "elk", "moose", "bison", "safari", "jungle",
    },
    "nature": {
        "forest", "tree", "branch", "grass", "flower", "plant", "mushroom", "toadstool",
        "mountain", "beach", "river", "lake", "ocean", "water", "sky", "cloud",
    },
    "mythology": {
        "mythology", "mythological", "mythic", "god", "goddess", "deity", "zeus", "thor",
        "odin", "anubis", "medusa", "minotaur", "centaur", "hydra", "phoenix",
    },
    "futureistic": {
        "futureistic", "futuristic", "future", "advanced", "high-tech", "cyber", "cyberpunk",
        "neon", "robot", "android", "cyborg", "spaceship", "spacecraft", "alien", "ufo",
    },
    "textures": {
        "texture", "textured", "pattern", "grain", "gritty", "rough", "smooth", "matte",
        "glossy", "woven", "fabric", "fur", "feather", "stone", "metal", "wood grain",
    },
    "architecture": {
        "building", "house", "castle", "fortress", "tower", "road", "street", "city",
        "window", "door", "stairs", "bridge", "wall",
    },
    "vehicles": {
        "car", "truck", "bus", "bicycle", "motorcycle", "airplane", "boat", "train", "crane",
    },
    "technology": {
        "computer", "laptop", "phone", "smartphone", "cell phone", "tv", "keyboard", "mouse", "camera",
    },
    "food": {
        "food", "fruit", "vegetable", "meal", "pizza", "cake", "bread", "drink", "cup", "bottle",
    },
    "fantasy": {
        "grim reaper", "reaper", "skull", "skeleton", "ghost", "monster", "dragon", "magic", "witch",
        "jack-o-lantern", "pumpkin", "scythe", "cloak", "robe",
    },
    "horror": {
        "horror", "haunted", "creepy", "spooky", "ghost", "zombie", "vampire", "werewolf",
        "blood", "grave", "graveyard", "skeleton", "skull", "monster", "nightmare", "demon",
    },
    "sci-fi": {
        "sci-fi", "science fiction", "futuristic", "future", "spaceship", "spacecraft", "alien", "ufo",
        "robot", "android", "cyborg", "laser", "planet", "galaxy", "starship", "space station",
    },
    "western": {
        "western", "cowboy", "cowgirl", "saloon", "sheriff", "revolver", "horse", "ranch",
        "outlaw", "desert", "frontier", "wagon", "lasso", "spurs", "stetson", "wild west",
    },
    "abstract": {
        "abstract", "pattern", "geometric", "surreal", "shape", "shapes",
    },
    "illustration": {
        "illustration", "drawing", "painting", "cartoon", "anime", "artwork",
    },
}


def _load_category_keyword_rules() -> dict[str, set[str]]:
    taxonomy_path = Path(__file__).resolve().parent / "categories.json"
    if not taxonomy_path.exists():
        return {key: set(values) for key, values in DEFAULT_CATEGORY_KEYWORD_RULES.items()}
    try:
        raw = json.loads(taxonomy_path.read_text(encoding="utf-8"))
    except Exception:
        return {key: set(values) for key, values in DEFAULT_CATEGORY_KEYWORD_RULES.items()}
    if not isinstance(raw, dict):
        return {key: set(values) for key, values in DEFAULT_CATEGORY_KEYWORD_RULES.items()}

    loaded: dict[str, set[str]] = {}
    for key, values in raw.items():
        name = str(key or "").strip().lower()
        if not name:
            continue
        if not isinstance(values, list):
            continue
        terms = {
            str(item).strip().lower()
            for item in values
            if str(item).strip()
        }
        if terms:
            loaded[name] = terms
    if not loaded:
        return {key: set(values) for key, values in DEFAULT_CATEGORY_KEYWORD_RULES.items()}
    return loaded


CATEGORY_KEYWORD_RULES: dict[str, set[str]] = _load_category_keyword_rules()
CATEGORY_NAMES = set(CATEGORY_KEYWORD_RULES.keys()) | {"photography"}

MISSING_METADATA_FIELDS = ("description", "keywords", "actions", "categories", "colors")

PERCEPTUAL_COLOR_ANCHORS: tuple[tuple[str, tuple[int, int, int]], ...] = (
    ("black", (10, 10, 10)),
    ("gray", (130, 130, 130)),
    ("white", (245, 245, 245)),
    ("brown", (120, 85, 58)),
    ("red", (220, 50, 47)),
    ("orange", (240, 140, 45)),
    ("yellow", (236, 212, 80)),
    ("green", (74, 160, 70)),
    ("teal", (45, 148, 145)),
    ("blue", (60, 118, 220)),
    ("purple", (135, 85, 176)),
    ("pink", (225, 120, 170)),
)


@dataclass
class ImageMetadata:
    description: str
    colors: list[dict[str, Any]]
    actions: list[str]
    objects: list[str]
    custom_tags: list[str]
    categories: list[str]
    confidence: dict[str, float] = field(default_factory=dict)
    ip_risk: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps(
            {
                "description": self.description,
                "colors": self.colors,
                "actions": self.actions,
                "objects": self.objects,
                "custom_tags": self.custom_tags,
                "categories": self.categories,
                "confidence": self.confidence,
                "ip_risk": self.ip_risk,
            },
            ensure_ascii=True,
            separators=(",", ":"),
        )

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "ImageMetadata":
        description = str(data.get("description", "")).strip()
        raw_colors = data.get("colors", [])
        raw_actions = data.get("actions", [])
        raw_objects = data.get("objects", [])
        raw_custom_tags = data.get("custom_tags", data.get("customTags", data.get("tags", [])))
        raw_categories = data.get("categories", data.get("category", []))
        raw_confidence = data.get("confidence", {})
        raw_ip_risk = data.get("ip_risk", data.get("ipRisk", {}))

        colors: list[dict[str, Any]] = []
        if isinstance(raw_colors, list):
            for row in raw_colors:
                if isinstance(row, dict):
                    colors.append(row)

        def _string_list(value: Any) -> list[str]:
            if isinstance(value, str):
                values = re.split(r"[,;\n|]+", value)
            elif isinstance(value, list):
                values = value
            else:
                return []
            out: list[str] = []
            seen: set[str] = set()
            for item in values:
                text = str(item).strip()
                if text:
                    key = text.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append(text)
            return out

        ip_risk_out: dict[str, Any] = {}
        if isinstance(raw_ip_risk, dict):
            level = str(raw_ip_risk.get("level", "")).strip().lower()
            if level in IP_RISK_LEVELS:
                ip_risk_out["level"] = level
            score_raw = raw_ip_risk.get("score")
            try:
                score = float(score_raw)
                if math.isfinite(score):
                    ip_risk_out["score"] = max(0.0, min(1.0, score))
            except Exception:
                pass
            raw_matches = raw_ip_risk.get("matches", [])
            if isinstance(raw_matches, list):
                matches = _dedupe_casefold([str(item).strip() for item in raw_matches if str(item).strip()])
                if matches:
                    ip_risk_out["matches"] = matches[:20]
            reason = str(raw_ip_risk.get("reason", "")).strip()
            if reason:
                ip_risk_out["reason"] = reason

        return ImageMetadata(
            description=description,
            colors=colors,
            actions=_string_list(raw_actions),
            objects=_string_list(raw_objects),
            custom_tags=_string_list(raw_custom_tags),
            categories=_string_list(raw_categories),
            confidence={
                str(key): max(0.0, min(1.0, float(value)))
                for key, value in (raw_confidence.items() if isinstance(raw_confidence, dict) else [])
                if isinstance(key, str)
            },
            ip_risk=ip_risk_out,
        )


class VisionMetadataGenerator:
    def __init__(
        self,
        caption_model: str = DEFAULT_CAPTION_MODEL,
        detector_model: str = DEFAULT_DETECTOR_MODEL,
        device_preference: str = "auto",
    ) -> None:
        caption_choice = str(caption_model or "").strip()
        detector_choice = str(detector_model or "").strip()
        device_choice = str(device_preference or "auto").strip().lower()
        self.caption_model = (
            caption_choice if caption_choice in SUPPORTED_CAPTION_MODELS else DEFAULT_CAPTION_MODEL
        )
        self.detector_model = (
            detector_choice if detector_choice in SUPPORTED_DETECTOR_MODELS else DEFAULT_DETECTOR_MODEL
        )
        self.device_preference = "cpu" if device_choice == "cpu" else "auto"
        self.captioner = None
        self.detector = None
        self._color_anchor_lab = [
            (name, rgb, self._rgb_to_lab(rgb))
            for name, rgb in PERCEPTUAL_COLOR_ANCHORS
        ]

    def _pipeline_device_kwargs(self) -> dict[str, int]:
        if self.device_preference == "cpu":
            return {"device": -1}
        return {}

    def load_models(self) -> None:
        if self.captioner is None:
            self.captioner = pipeline(
                "image-to-text",
                model=self.caption_model,
                **self._pipeline_device_kwargs(),
            )

    def _ensure_detector(self) -> bool:
        if self.detector_model == DETECTOR_DISABLED_MODEL:
            return False
        if self.detector is not None:
            return True
        self.detector = pipeline(
            "zero-shot-object-detection",
            model=self.detector_model,
            **self._pipeline_device_kwargs(),
        )
        return True

    def analyze_image(self, image_path: Path, high_recall: bool = False, fast_mode: bool = False) -> ImageMetadata:
        with Image.open(image_path) as raw:
            image = raw.convert("RGB")
        effective_fast_mode = bool(fast_mode) and not bool(high_recall)
        description = self._generate_description(image, high_recall=high_recall, fast_mode=effective_fast_mode)
        objects = self._detect_objects(image, description, high_recall=high_recall)
        colors = self._extract_dominant_colors(image, fast_mode=effective_fast_mode)
        actions = self._extract_actions(description)
        categories = self._categorize_image(description, objects, actions)
        confidence = self._estimate_confidence(
            description=description,
            objects=objects,
            actions=actions,
            categories=categories,
            colors=colors,
        )
        return ImageMetadata(
            description=description,
            colors=colors,
            actions=actions,
            objects=objects,
            custom_tags=[],
            categories=categories,
            confidence=confidence,
        )

    def _generate_description(self, image: Image.Image, high_recall: bool = False, fast_mode: bool = False) -> str:
        assert self.captioner is not None
        if fast_mode and not high_recall:
            captions = self._generate_caption_candidates(
                image=image,
                max_new_tokens=72,
                num_return_sequences=1,
                num_beams=2,
            )
        elif high_recall:
            captions = self._generate_caption_candidates(
                image=image,
                max_new_tokens=96,
                num_return_sequences=3,
                num_beams=4,
            )
        else:
            captions = self._generate_caption_candidates(
                image=image,
                max_new_tokens=96,
                num_return_sequences=4,
                num_beams=5,
            )
        if not captions:
            return ""

        best = max(captions, key=self._caption_quality_score)
        if self._looks_truncated_caption(best):
            extra = self._generate_caption_candidates(
                image=image,
                max_new_tokens=96 if (fast_mode and not high_recall) else (120 if high_recall else 140),
                num_return_sequences=1 if (fast_mode and not high_recall) else (3 if high_recall else 5),
                num_beams=3 if (fast_mode and not high_recall) else (4 if high_recall else 5),
            )
            if extra:
                best = max(captions + extra, key=self._caption_quality_score)

        return self._finalize_caption(best)

    def _generate_caption_candidates(
        self,
        image: Image.Image,
        max_new_tokens: int,
        num_return_sequences: int,
        num_beams: int = 5,
    ) -> list[str]:
        assert self.captioner is not None
        beam_count = max(1, int(num_beams), int(num_return_sequences))
        try:
            result = self.captioner(
                image,
                max_new_tokens=max_new_tokens,
                num_beams=beam_count,
                num_return_sequences=num_return_sequences,
                repetition_penalty=1.35,
                no_repeat_ngram_size=2,
                early_stopping=True,
            )
        except TypeError:
            result = self.captioner(image, max_new_tokens=max_new_tokens)

        if not result:
            return []

        rows = result if isinstance(result, list) else [result]
        captions: list[str] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            text = self._sanitize_caption(str(row.get("generated_text", "")))
            if text:
                captions.append(text)
        return captions

    def _detect_objects(self, image: Image.Image, description: str, high_recall: bool = False) -> list[str]:
        texts: list[str] = []
        text_keys: set[str] = set()
        primary = self._sanitize_caption(description)
        if primary:
            texts.append(primary)
            text_keys.add(primary.lower())

        noun_terms = self._noun_terms_from_description(description)
        ranked = self._objects_from_caption_texts(texts)
        if ranked:
            if not high_recall:
                return self._prune_generic_labels(_dedupe_casefold(ranked + noun_terms))[:15]
            # Adaptive high recall:
            # if the primary caption already yields a solid object set, avoid
            # the much heavier extra-caption and detector work.
            if len(ranked) >= 4 or (len(ranked) >= 3 and any(label in PREFERRED_SCENE_LABELS for label in ranked)):
                return self._prune_generic_labels(_dedupe_casefold(ranked + noun_terms))[:20]

        # Throughput optimization:
        # In normal mode, avoid a second caption-model pass and derive objects
        # from the primary description text. High-recall keeps extra candidates.
        if high_recall:
            extra_candidates = self._generate_caption_candidates(
                image=image,
                max_new_tokens=104,
                num_return_sequences=2,
                num_beams=3,
            )
            for caption in extra_candidates:
                clean = self._sanitize_caption(caption)
                if not clean:
                    continue
                key = clean.lower()
                if key in text_keys:
                    continue
                text_keys.add(key)
                texts.append(clean)

        ranked = self._objects_from_caption_texts(texts)
        if ranked:
            cap = 20 if high_recall else 15
            return self._prune_generic_labels(_dedupe_casefold(ranked + noun_terms))[:cap]

        # Last-resort fallback: if caption extraction fails, try detector.
        if high_recall and len(noun_terms) < 3:
            try:
                if self._ensure_detector():
                    fallback_detected = self._detect_objects_with_detector(image, description, high_recall=high_recall)
                    cap = 20 if high_recall else 15
                    return self._prune_generic_labels(_dedupe_casefold(fallback_detected + noun_terms))[:cap]
            except Exception:
                pass

        return self._prune_generic_labels(_dedupe_casefold(self._objects_from_description(description) + noun_terms))[:8]

    def _objects_from_caption_texts(self, texts: list[str]) -> list[str]:
        if not texts:
            return []

        scores: dict[str, float] = {}
        first_text = True
        for text in texts:
            text_lower = text.lower()
            text_objects: list[str] = []
            text_objects.extend(self._objects_from_description(text_lower))
            text_objects.extend(self._objects_from_object_library(text_lower))
            deduped_text_objects = self._prune_generic_labels(_dedupe_casefold(text_objects))
            if not deduped_text_objects:
                continue

            weight = 1.0 if first_text else 0.65
            first_text = False
            for label in deduped_text_objects:
                scores[label] = scores.get(label, 0.0) + weight

        ordered = sorted(
            scores.keys(),
            key=lambda label: (
                scores.get(label, 0.0),
                1 if label in PREFERRED_SCENE_LABELS else 0,
                1 if label in GENERIC_OBJECT_LABELS else 0,
                len(label),
            ),
            reverse=True,
        )
        return self._prune_generic_labels(ordered)

    def _objects_from_object_library(self, text: str) -> list[str]:
        desc = text.lower()
        words = set(re.findall(r"[a-z][a-z-]{2,}", desc))
        found: list[str] = []
        seen: set[str] = set()

        def add(label: str) -> None:
            clean = self._normalize_object_label(label)
            if not clean or clean in seen:
                return
            seen.add(clean)
            found.append(clean)

        for label in OBJECT_PROMPT_LIBRARY:
            clean = self._normalize_object_label(label)
            if not clean:
                continue
            if " " in clean:
                if re.search(rf"\b{re.escape(clean)}\b", desc):
                    add(clean)
            elif clean in words:
                add(clean)

        return found

    def _detect_objects_with_detector(self, image: Image.Image, description: str, high_recall: bool = False) -> list[str]:
        assert self.detector is not None
        detector_image = image
        if high_recall:
            width, height = image.size
            if max(width, height) > 1600:
                detector_image = image.copy()
                detector_image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)

        candidate_labels = self._build_candidate_labels(description, high_recall=high_recall)
        if not candidate_labels:
            return self._objects_from_description(description)

        label_batch_size = 64 if high_recall else 64
        label_batches = self._chunked_labels(candidate_labels, label_batch_size)
        best_score: dict[str, float] = {}
        seen_count: dict[str, int] = {}

        for view_index, view in enumerate(self._detection_views(detector_image, high_recall=high_recall)):
            if high_recall:
                threshold = 0.1 if view_index == 0 else 0.08
            else:
                threshold = 0.14 if view_index == 0 else 0.11
            for label_batch in label_batches:
                results = self.detector(
                    view,
                    candidate_labels=label_batch,
                    threshold=threshold,
                )

                for row in results:
                    label = self._normalize_object_label(str(row.get("label", "")).strip().lower())
                    if not label:
                        continue
                    score = float(row.get("score", 0.0))
                    min_score = self._minimum_score_for_label(label, high_recall=high_recall)
                    if score < min_score:
                        continue
                    seen_count[label] = seen_count.get(label, 0) + 1
                    if label not in best_score or score > best_score[label]:
                        best_score[label] = score

        detected = sorted(
            best_score.keys(),
            key=lambda label: (
                1 if label in PREFERRED_SCENE_LABELS else 0,
                seen_count.get(label, 0),
                best_score.get(label, 0.0),
            ),
            reverse=True,
        )

        combined: list[str] = []
        seen: set[str] = set()
        for label in detected + self._objects_from_description(description):
            clean = self._normalize_object_label(label)
            if clean and clean not in seen:
                seen.add(clean)
                combined.append(clean)

        cap = 20 if high_recall else 15
        return self._prune_generic_labels(combined)[:cap]

    def _chunked_labels(self, labels: list[str], size: int) -> list[list[str]]:
        if size <= 0:
            return [labels]
        return [labels[i : i + size] for i in range(0, len(labels), size)]

    def _detection_views(self, image: Image.Image, high_recall: bool = False) -> list[Image.Image]:
        views: list[Image.Image] = [image]
        width, height = image.size
        if width < 420 or height < 420:
            return views

        tile_w = int(width * 0.62)
        tile_h = int(height * 0.62)
        boxes = [
            (0, 0, tile_w, tile_h),
            (max(0, width - tile_w), 0, width, tile_h),
            (0, max(0, height - tile_h), tile_w, height),
            (max(0, width - tile_w), max(0, height - tile_h), width, height),
            (
                max(0, (width - tile_w) // 2),
                max(0, (height - tile_h) // 2),
                min(width, (width + tile_w) // 2),
                min(height, (height + tile_h) // 2),
            ),
        ]
        for box in boxes:
            left, top, right, bottom = box
            if right - left < 120 or bottom - top < 120:
                continue
            views.append(image.crop((left, top, right, bottom)))

        if high_recall and width >= 520 and height >= 520:
            cols = 2
            rows = 2
            overlap = 0.16
            tile_w = int(width / (cols - (cols - 1) * overlap))
            tile_h = int(height / (rows - (rows - 1) * overlap))
            step_x = max(1, int(tile_w * (1.0 - overlap)))
            step_y = max(1, int(tile_h * (1.0 - overlap)))
            for top in range(0, max(1, height - tile_h + 1), step_y):
                for left in range(0, max(1, width - tile_w + 1), step_x):
                    right = min(width, left + tile_w)
                    bottom = min(height, top + tile_h)
                    if right - left < 120 or bottom - top < 120:
                        continue
                    views.append(image.crop((left, top, right, bottom)))
        max_views = 8 if high_recall else 6
        return views[:max_views]

    def _normalize_object_label(self, label: str) -> str:
        clean = re.sub(r"[^a-z0-9\s-]", " ", label)
        clean = re.sub(r"\s+", " ", clean).strip().lower()
        clean = re.sub(r"^(a|an|the)\s+", "", clean)
        clean = re.sub(r"\s+\d+$", "", clean)
        if not clean:
            return ""
        aliases = {
            "automobile": "car",
            "motorbike": "motorcycle",
            "tvmonitor": "tv",
            "pottedplant": "potted plant",
            "diningtable": "dining table",
            "aeroplane": "airplane",
            "jack o lantern": "jack-o-lantern",
            "jack o lanterns": "jack-o-lantern",
            "jack-o-lanterns": "jack-o-lantern",
            "cellphone": "phone",
            "cell phone": "phone",
            "mobile phone": "phone",
            "smart phone": "phone",
            "smartphone": "phone",
            "phones": "phone",
            "handbag": "purse",
            "handbags": "purse",
            "purses": "purse",
            "shoulder bag": "purse",
            "tote bag": "purse",
            "construction cranes": "construction crane",
            "cranes": "crane",
            "fungi": "mushroom",
            "fungus": "mushroom",
            "cannabis": "cannabis flower",
            "marijuana": "cannabis flower",
            "marijuana flower": "cannabis flower",
            "cannabis bud": "cannabis flower",
            "toadstools": "toadstool",
            "toadstool mushroom": "mushroom",
            "pumpkins": "pumpkin",
            "mushrooms": "mushroom",
            "castles": "castle",
            "towers": "tower",
            "grim reaper figure": "grim reaper",
            "reaper": "grim reaper",
            "hooded figure": "grim reaper",
            "hooded person": "grim reaper",
            "scythes": "scythe",
            "banda": "bandana",
            "bandanna": "bandana",
        }
        clean = aliases.get(clean, clean)
        if clean.endswith("s") and len(clean) > 4 and clean not in {"glass", "grass"}:
            singular = clean[:-1]
            clean = aliases.get(singular, singular)
        return clean

    def _build_candidate_labels(self, description: str, high_recall: bool = False) -> list[str]:
        labels: list[str] = []
        seen: set[str] = set()

        def add(label: str) -> None:
            clean = self._normalize_object_label(label)
            if clean and clean not in seen:
                seen.add(clean)
                labels.append(clean)

        desc_lower = description.lower()
        words = re.findall(r"[a-z][a-z-]{2,}", description.lower())
        desc_word_set = set(words)

        # Always prioritize objects already inferred from caption text.
        for inferred in self._objects_from_description(description):
            add(inferred)

        for word in words:
            if word not in CAPTION_STOPWORDS:
                add(word)

        for i in range(len(words) - 1):
            w1 = words[i]
            w2 = words[i + 1]
            if w1 in CAPTION_STOPWORDS or w2 in CAPTION_STOPWORDS:
                continue
            add(f"{w1} {w2}")

        for i in range(len(words) - 2):
            w1 = words[i]
            w2 = words[i + 1]
            w3 = words[i + 2]
            if w1 in CAPTION_STOPWORDS or w2 in CAPTION_STOPWORDS or w3 in CAPTION_STOPWORDS:
                continue
            add(f"{w1} {w2} {w3}")

        # Add related prompts when caption implies specific scenes/props.
        if "construction site" in desc_lower or "construction" in desc_lower:
            add("construction site")
            add("construction crane")
            add("crane")
            add("scaffolding")
        if "phone" in desc_lower or "calling" in desc_lower:
            add("phone")
            add("cell phone")
            add("smartphone")
        if "purse" in desc_lower or "handbag" in desc_lower or "bag" in desc_lower:
            add("purse")
            add("handbag")

        # Prioritize a standard prompt library (COCO + general extensions).
        matched_library: list[str] = []
        unmatched_library: list[str] = []
        for label in OBJECT_PROMPT_LIBRARY:
            tokens = set(re.findall(r"[a-z][a-z-]{2,}", label.lower()))
            if tokens and (tokens & desc_word_set):
                matched_library.append(label)
            else:
                unmatched_library.append(label)

        for label in matched_library:
            add(label)
        for label in unmatched_library:
            add(label)

        limit = 160 if high_recall else 220
        return labels[:limit]

    def _objects_from_description(self, description: str) -> list[str]:
        desc = description.lower()
        phrase_map = {
            "light switch": "light switch",
            "switch plate": "switch plate",
            "picture frame": "picture frame",
            "grim reaper": "grim reaper",
            "hooded figure": "grim reaper",
            "jack o lantern": "jack-o-lantern",
            "jack-o-lantern": "jack-o-lantern",
            "haunted castle": "castle",
            "castle tower": "tower",
            "toadstool": "toadstool",
            "mushroom": "mushroom",
            "mushrooms": "mushroom",
            "construction site": "construction site",
            "construction crane": "construction crane",
            "crane": "crane",
            "cell phone": "phone",
            "mobile phone": "phone",
            "smartphone": "phone",
            "phone": "phone",
            "purse": "purse",
            "handbag": "purse",
            "pipe": "pipe",
            "tobacco pipe": "pipe",
            "bandana": "bandana",
            "banda": "bandana",
            "bandanna": "bandana",
            "marijuana flower": "cannabis flower",
            "cannabis flower": "cannabis flower",
            "cannabis bud": "cannabis flower",
        }
        objects: list[str] = []
        for phrase, label in phrase_map.items():
            if phrase in desc:
                objects.append(label)

        words = set(re.findall(r"[a-z][a-z-]{2,}", desc))
        for token in (
            "skull",
            "skeleton",
            "bone",
            "mask",
            "wall",
            "frame",
            "mirror",
            "castle",
            "tower",
            "moon",
            "lantern",
            "pumpkin",
            "mushroom",
            "toadstool",
            "forest",
            "tree",
            "crane",
            "construction",
            "site",
            "phone",
            "purse",
            "bag",
            "bandana",
            "pipe",
            "flower",
            "cannabis",
            "scythe",
            "cloak",
            "robe",
        ):
            if token in words and token not in objects:
                objects.append(token)
        return objects[:8]

    def _noun_terms_from_description(self, description: str) -> list[str]:
        desc = str(description or "").lower()
        if not desc:
            return []

        words = re.findall(r"[a-z][a-z-]{2,}", desc)
        if not words:
            return []

        action_terms = set(ACTION_PATTERNS.keys())
        out: list[str] = []
        seen: set[str] = set()

        def add(label: str) -> None:
            clean = self._normalize_object_label(label)
            if not clean:
                return
            if clean in CAPTION_STOPWORDS:
                return
            if clean in CAPTION_NON_OBJECT_TERMS:
                return
            if clean in CAPTION_ATTRIBUTE_TERMS:
                return
            if clean in action_terms:
                return
            if clean not in seen:
                seen.add(clean)
                out.append(clean)

        for word in words:
            if (
                word in CAPTION_STOPWORDS
                or word in CAPTION_NON_OBJECT_TERMS
                or word in CAPTION_ATTRIBUTE_TERMS
                or word in action_terms
            ):
                continue
            add(word)

        for i in range(len(words) - 1):
            w1 = words[i]
            w2 = words[i + 1]
            if w1 in CAPTION_STOPWORDS or w2 in CAPTION_STOPWORDS:
                continue
            if w1 in CAPTION_NON_OBJECT_TERMS or w2 in CAPTION_NON_OBJECT_TERMS:
                continue
            if w1 in CAPTION_ATTRIBUTE_TERMS or w2 in CAPTION_ATTRIBUTE_TERMS:
                continue
            phrase = f"{w1} {w2}"
            if phrase in OBJECT_PROMPT_LIBRARY or phrase in {
                "construction site",
                "construction crane",
                "light switch",
                "switch plate",
                "picture frame",
                "cell phone",
                "mobile phone",
                "smart phone",
                "jack o lantern",
                "jack-o-lantern",
            }:
                add(phrase)

        return out[:14]

    def _minimum_score_for_label(self, label: str, high_recall: bool = False) -> float:
        if label in {"object", "item", "thing", "art"}:
            threshold = 0.35
            return max(0.2, threshold - (0.05 if high_recall else 0.0))
        if label in {"sculpture", "statue", "figure", "person", "man", "woman", "child"}:
            threshold = 0.28
            return max(0.14, threshold - (0.05 if high_recall else 0.0))
        if label in PREFERRED_SCENE_LABELS:
            threshold = 0.14
            return max(0.08, threshold - (0.03 if high_recall else 0.0))
        if label in {"skeleton", "skull", "mushroom", "toadstool", "forest", "crane", "construction crane", "phone", "purse"}:
            threshold = 0.15
            return max(0.08, threshold - (0.03 if high_recall else 0.0))
        threshold = 0.2
        return max(0.1, threshold - (0.03 if high_recall else 0.0))

    def _prune_generic_labels(self, labels: list[str]) -> list[str]:
        if not labels:
            return labels

        specifics = [label for label in labels if label not in GENERIC_OBJECT_LABELS]
        filtered = [label for label in labels if label not in {"object", "item", "thing", "art"}]

        if specifics:
            filtered = [label for label in filtered if label not in {"sculpture", "statue"}]

        if any(label in {"grim reaper", "skeleton", "skull"} for label in filtered):
            filtered = [label for label in filtered if label not in {"person", "man", "woman", "child", "figure"}]

        deduped: list[str] = []
        seen: set[str] = set()
        for label in filtered:
            if label not in seen:
                seen.add(label)
                deduped.append(label)
        return deduped

    def _sanitize_caption(self, caption: str) -> str:
        text = caption.strip()
        if not text:
            return ""
        text = re.sub(r"\s+", " ", text)
        sep = r"(?:\s*(?:[,;:/|]\s*|\s+))"
        prev = ""
        while text != prev:
            prev = text
            for n in (3, 2, 1):
                pattern = rf"\b((?:[a-z-]+(?:{sep}[a-z-]+){{{n - 1}}}))(?:(?:{sep})\1\b)+"
                text = re.sub(pattern, r"\1", text, flags=re.IGNORECASE)
            text = re.sub(r"(?:\s*[,;:/|]\s*){2,}", ", ", text)
            text = re.sub(r"\s+", " ", text)
        text = re.sub(r"\s+([,.!?;:])", r"\1", text)
        return text.strip(" ,;")

    def _looks_truncated_caption(self, caption: str) -> bool:
        text = caption.strip()
        if not text:
            return False
        if text.endswith((".", "!", "?")):
            return False
        words = re.findall(r"[a-z][a-z-]{2,}", text.lower())
        if len(words) < 7:
            return False
        if words[-1] in CAPTION_STOPWORDS:
            return True
        return len(words) >= 12

    def _finalize_caption(self, caption: str) -> str:
        text = caption.strip()
        if not text:
            return ""
        text = self._correct_caption_spelling(text)
        if not text.endswith((".", "!", "?")):
            text = f"{text}."
        return text

    def _correct_caption_spelling(self, text: str) -> str:
        raw = str(text or "").strip()
        if not raw:
            return ""

        # Apply context-sensitive phrase normalizations first so short tokens
        # like "dart" can be corrected safely when part of well-known names.
        raw = re.sub(r"\bdart(?=\s+(?:vader|maul|sidious|revan)\b)", "darth", raw, flags=re.IGNORECASE)
        for source, target in IP_RISK_TEXT_NORMALIZATIONS.items():
            pattern = rf"\b{re.escape(source)}\b"
            raw = re.sub(pattern, target, raw, flags=re.IGNORECASE)

        known_terms = self._caption_spell_vocabulary()

        def replace_word(match: re.Match[str]) -> str:
            token = match.group(0)
            lower = token.lower()

            direct = CAPTION_TYPO_CORRECTIONS.get(lower)
            if direct:
                return self._match_word_case(token, direct)

            # Keep function words untouched; they should never be correction targets.
            if lower in CAPTION_STOPWORDS:
                return token
            if lower in known_terms or len(lower) < 5:
                return token
            if any(ch.isdigit() for ch in lower):
                return token

            best = self._best_known_term_match(lower, known_terms)
            if not best:
                return token
            if best in CAPTION_STOPWORDS:
                return token

            # Conservative fuzzy correction: only accept single-edit substitutions.
            # This prevents semantic drift like "clown" -> "close".
            edit_distance = self._bounded_levenshtein(lower, best, max_distance=1)
            if edit_distance is None:
                return token
            return self._match_word_case(token, best)

        return re.sub(r"[A-Za-z][A-Za-z'-]{2,}", replace_word, raw)

    def _caption_spell_vocabulary(self) -> set[str]:
        vocab: set[str] = set()

        common = {
            "painting",
            "illustration",
            "photo",
            "photograph",
            "image",
            "picture",
            "drawing",
            "dog",
            "cat",
            "woman",
            "man",
            "child",
            "wearing",
            "standing",
            "sitting",
            "holding",
            "table",
            "bandana",
            "balloon",
            "balloons",
            "sombrero",
            "chihuahua",
            "marijuana",
            "cannabis",
            "flower",
            "flowers",
            "forest",
            "castle",
            "pumpkin",
            "jack-o-lantern",
            "phone",
            "purse",
            "construction",
            "crane",
            "site",
        }
        vocab.update(common)
        vocab.update(CAPTION_DOMAIN_TERMS)
        vocab.update(CAPTION_ATTRIBUTE_TERMS)

        # Include object prompt terms so common nouns are treated as valid words
        # instead of being "corrected" into unrelated tokens.
        for phrase in OBJECT_PROMPT_LIBRARY:
            for term in re.findall(r"[a-z][a-z-]{2,}", str(phrase).lower()):
                vocab.add(term)

        return vocab

    def _best_known_term_match(self, word: str, vocab: set[str]) -> str:
        candidates = [term for term in vocab if abs(len(term) - len(word)) <= 2 and term[0] == word[0]]
        if not candidates:
            return ""
        best = min(candidates, key=lambda term: self._bounded_levenshtein(word, term, max_distance=3) or 99)
        best_distance = self._bounded_levenshtein(word, best, max_distance=3)
        if best_distance is None:
            return ""
        if best_distance > 2:
            return ""
        return best

    def _bounded_levenshtein(self, source: str, target: str, max_distance: int = 2) -> int | None:
        if source == target:
            return 0
        if abs(len(source) - len(target)) > max_distance:
            return None

        prev = list(range(len(target) + 1))
        for i, s_char in enumerate(source, start=1):
            cur = [i]
            row_min = i
            for j, t_char in enumerate(target, start=1):
                cost = 0 if s_char == t_char else 1
                val = min(
                    prev[j] + 1,
                    cur[j - 1] + 1,
                    prev[j - 1] + cost,
                )
                cur.append(val)
                if val < row_min:
                    row_min = val
            if row_min > max_distance:
                return None
            prev = cur
        distance = prev[-1]
        if distance > max_distance:
            return None
        return distance

    def _match_word_case(self, original: str, replacement: str) -> str:
        if original.isupper():
            return replacement.upper()
        if original.istitle():
            return replacement.title()
        return replacement

    def _caption_quality_score(self, caption: str) -> float:
        words = re.findall(r"[a-z][a-z-]{2,}", caption.lower())
        if not words:
            return 0.0
        content = [w for w in words if w not in CAPTION_STOPWORDS]
        unique = set(content)
        repeated = len(content) - len(unique)
        scene_bonus = sum(2 for w in unique if w in PREFERRED_SCENE_LABELS)
        punctuation_bonus = 1.2 if caption.strip().endswith((".", "!", "?")) else -2.0
        truncation_penalty = 3.5 if self._looks_truncated_caption(caption) else 0.0
        return (len(unique) * 2.0) + (len(content) * 0.2) + float(scene_bonus) + punctuation_bonus - (repeated * 1.8) - truncation_penalty

    def _extract_dominant_colors(self, image: Image.Image, n: int = 6, fast_mode: bool = False) -> list[dict[str, Any]]:
        base_size = 280 if fast_mode else 360
        base_sample = image.resize((base_size, base_size)).convert("RGB")
        smooth_sample = base_sample.filter(ImageFilter.GaussianBlur(radius=0.9))
        width, height = base_sample.size
        margin_x = max(1, int(width * 0.2))
        margin_y = max(1, int(height * 0.2))
        center_sample = base_sample.crop((margin_x, margin_y, width - margin_x, height - margin_y))
        center_smooth = center_sample.filter(ImageFilter.GaussianBlur(radius=0.6))

        grouped, total = self._group_quantized_colors(smooth_sample, palette_size=30 if fast_mode else 36)
        center_grouped, center_total = self._group_quantized_colors(center_smooth, palette_size=34 if fast_mode else 40)

        ranked_rows: list[tuple[float, dict[str, Any]]] = []
        for name, row in grouped.items():
            count = int(row.get("count", 0))
            if count <= 0:
                continue
            full_percent = (count / max(1, total)) * 100.0
            sat_avg = float(row.get("sat_sum", 0.0)) / float(count)

            center_row = center_grouped.get(name)
            center_count = int(center_row.get("count", 0)) if center_row else 0
            center_percent = (center_count / max(1, center_total)) * 100.0
            center_sat_avg = (
                float(center_row.get("sat_sum", 0.0)) / float(center_count)
                if center_row and center_count > 0
                else 0.0
            )

            if full_percent < 0.7 and center_percent < 0.9:
                continue

            neutral_penalty = 7.5 if self._is_neutral_color_label(name) else 0.0
            score = (
                (center_percent * 1.7)
                + (full_percent * 0.7)
                + (max(sat_avg, center_sat_avg) * 24.0)
                - neutral_penalty
            )
            ranked_rows.append((score, row))

        ranked_rows.sort(key=lambda entry: entry[0], reverse=True)

        colors: list[dict[str, Any]] = []
        seen_names: set[str] = set()
        for _, row in ranked_rows:
            payload = self._build_color_payload(row, total)
            if payload["name"] in seen_names:
                continue
            seen_names.add(str(payload["name"]))
            colors.append(payload)
            if len(colors) >= n:
                break

        # Accent pass (no blur + larger palette) to capture vivid smaller regions.
        accent_grouped, accent_total = self._group_quantized_colors(base_sample, palette_size=40 if fast_mode else 52)
        accent_rows = []
        high_sat_candidate: dict[str, Any] | None = None
        high_sat_score = -1.0
        for name, row in accent_grouped.items():
            count = int(row.get("count", 0))
            if count <= 0:
                continue
            percent = (count / max(1, accent_total)) * 100.0
            sat_avg = float(row.get("sat_sum", 0.0)) / float(count)
            light_avg = float(row.get("light_sum", 0.0)) / float(count)
            center_row = center_grouped.get(name)
            center_count = int(center_row.get("count", 0)) if center_row else 0
            center_percent = (center_count / max(1, center_total)) * 100.0

            candidate_payload = self._build_color_payload(row, accent_total, prefer_peak=True)
            candidate_rgb = candidate_payload.get("rgb", [0, 0, 0])
            if isinstance(candidate_rgb, list) and len(candidate_rgb) == 3:
                candidate_tuple = (int(candidate_rgb[0]), int(candidate_rgb[1]), int(candidate_rgb[2]))
                _, candidate_sat, candidate_light = self._rgb_to_hsl(candidate_tuple)
                candidate_family = self._color_family_from_rgb(candidate_tuple)
                if candidate_family != "neutral":
                    candidate_score = (candidate_sat * 3.2) + (center_percent * 0.45) + (percent * 0.25)
                    if (
                        candidate_sat >= 0.52
                        and candidate_light >= 0.22
                        and (percent >= 0.35 or center_percent >= 0.35)
                        and candidate_score > high_sat_score
                    ):
                        high_sat_score = candidate_score
                        high_sat_candidate = candidate_payload

            if percent < 0.8 and center_percent < 1.0:
                continue
            if sat_avg < 0.4:
                continue
            if light_avg < 0.14 and sat_avg < 0.72:
                continue
            neutral_penalty = 6.0 if self._is_neutral_color_label(name) else 0.0
            vivid_score = (center_percent * 1.6) + (sat_avg * 3.2) + (light_avg * 1.25) + (percent * 0.2) - neutral_penalty
            accent_rows.append((vivid_score, row))

        accent_rows.sort(key=lambda entry: entry[0], reverse=True)
        accent_limit = 2 if fast_mode else 3
        accent_added = 0
        for _, row in accent_rows:
            payload = self._build_color_payload(row, accent_total, prefer_peak=True)
            name = str(payload["name"])
            if name in seen_names:
                continue
            seen_names.add(name)
            colors.append(payload)
            accent_added += 1
            if accent_added >= accent_limit:
                break

        # Ensure strong hue diversity for foreground-like colors.
        family_seen: set[str] = set()
        for payload in colors:
            rgb = payload.get("rgb", [0, 0, 0])
            if isinstance(rgb, list) and len(rgb) == 3:
                family_seen.add(self._color_family_from_rgb((int(rgb[0]), int(rgb[1]), int(rgb[2]))))

        max_total_colors = max(n + (1 if fast_mode else 2), 7 if fast_mode else 8)
        for _, row in accent_rows:
            if len(colors) >= max_total_colors:
                break
            payload = self._build_color_payload(row, accent_total, prefer_peak=True)
            name = str(payload["name"])
            if name in seen_names:
                continue
            if self._is_neutral_color_label(name):
                continue
            rgb = payload.get("rgb", [0, 0, 0])
            if not isinstance(rgb, list) or len(rgb) != 3:
                continue
            family = self._color_family_from_rgb((int(rgb[0]), int(rgb[1]), int(rgb[2])))
            if family in {"neutral", "brown", "tan"}:
                continue
            if family in family_seen:
                continue
            count = int(row.get("count", 0))
            percent = (count / max(1, accent_total)) * 100.0
            if percent < 1.1:
                continue
            colors.append(payload)
            seen_names.add(name)
            family_seen.add(family)
            if len(family_seen) >= 6:
                break

        # Always keep one highly saturated accent when available.
        if high_sat_candidate is not None:
            hs_name = str(high_sat_candidate.get("name", ""))
            hs_rgb = high_sat_candidate.get("rgb", [0, 0, 0])
            hs_sat = 0.0
            if isinstance(hs_rgb, list) and len(hs_rgb) == 3:
                _, hs_sat, _ = self._rgb_to_hsl((int(hs_rgb[0]), int(hs_rgb[1]), int(hs_rgb[2])))

            matched_idx = -1
            for idx, color in enumerate(colors):
                if str(color.get("name", "")) == hs_name:
                    matched_idx = idx
                    break

            if matched_idx >= 0:
                existing_rgb = colors[matched_idx].get("rgb", [0, 0, 0])
                existing_sat = 0.0
                if isinstance(existing_rgb, list) and len(existing_rgb) == 3:
                    _, existing_sat, _ = self._rgb_to_hsl(
                        (int(existing_rgb[0]), int(existing_rgb[1]), int(existing_rgb[2]))
                    )
                if hs_sat > existing_sat:
                    colors[matched_idx] = high_sat_candidate
            else:
                colors.insert(0, high_sat_candidate)
                seen_names.add(hs_name)

        # Keep neutrals in check so backgrounds do not dominate.
        if colors:
            normalized_colors: list[dict[str, Any]] = []
            has_black = any(str(color.get("name", "")).lower() == "black" for color in colors)
            for color in colors:
                rgb = color.get("rgb", [0, 0, 0])
                if not (isinstance(rgb, list) and len(rgb) == 3):
                    normalized_colors.append(color)
                    continue
                rgb_tuple = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
                if self._is_near_black_chromatic(rgb_tuple):
                    if has_black:
                        continue
                    color = {
                        "name": "black",
                        "rgb": [int(rgb_tuple[0]), int(rgb_tuple[1]), int(rgb_tuple[2])],
                        "percent": float(color.get("percent", 0.0)),
                    }
                    has_black = True
                normalized_colors.append(color)
            colors = normalized_colors

            chromatic_total = sum(1 for color in colors if not self._is_neutral_color_label(color.get("name", "")))
            neutral_cap = 1 if chromatic_total >= 4 else 2
            trimmed: list[dict[str, Any]] = []
            neutral_kept = 0
            for color in colors:
                if self._is_neutral_color_label(color.get("name", "")):
                    if neutral_kept >= neutral_cap:
                        continue
                    neutral_kept += 1
                trimmed.append(color)
            colors = trimmed

        # Surface foreground/main hues first when they are present.
        if colors:
            chromatic = [color for color in colors if not self._is_neutral_color_label(color.get("name", ""))]
            neutrals = [color for color in colors if self._is_neutral_color_label(color.get("name", ""))]
            if len(chromatic) >= 2:
                colors = chromatic + neutrals

        if not colors:
            fallback = sorted(grouped.values(), key=lambda row: row["count"], reverse=True)[:n]
            for row in fallback:
                colors.append(self._build_color_payload(row, total))

        return colors

    def _dedupe_color_payloads(self, colors: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not isinstance(colors, list) or not colors:
            return []

        merged: dict[str, dict[str, Any]] = {}
        order: list[str] = []
        for row in colors:
            if not isinstance(row, dict):
                continue
            name_raw = str(row.get("name", "")).strip()
            if not name_raw:
                continue
            key = name_raw.lower()
            percent_raw = row.get("percent", 0.0)
            try:
                percent = float(percent_raw)
                if not math.isfinite(percent):
                    percent = 0.0
            except Exception:
                percent = 0.0
            percent = max(0.0, percent)

            rgb_raw = row.get("rgb", [0, 0, 0])
            rgb: list[int] = [0, 0, 0]
            if isinstance(rgb_raw, list) and len(rgb_raw) == 3:
                try:
                    rgb = [
                        max(0, min(255, int(rgb_raw[0]))),
                        max(0, min(255, int(rgb_raw[1]))),
                        max(0, min(255, int(rgb_raw[2]))),
                    ]
                except Exception:
                    rgb = [0, 0, 0]

            if key not in merged:
                merged[key] = {"name": key, "rgb": rgb, "percent": percent}
                order.append(key)
                continue

            prev_percent = float(merged[key].get("percent", 0.0))
            merged[key]["percent"] = prev_percent + percent
            if percent > prev_percent:
                merged[key]["rgb"] = rgb

        if not merged:
            return []

        out = [merged[key] for key in order if key in merged]
        total_percent = sum(float(row.get("percent", 0.0)) for row in out)
        if total_percent > 100.5:
            for row in out:
                row["percent"] = round((float(row.get("percent", 0.0)) / total_percent) * 100.0, 2)
        else:
            for row in out:
                row["percent"] = round(float(row.get("percent", 0.0)), 2)

        out.sort(key=lambda row: float(row.get("percent", 0.0)), reverse=True)
        return out

    def _group_quantized_colors(self, sample: Image.Image, palette_size: int) -> tuple[dict[str, dict[str, Any]], int]:
        palette_adaptive = getattr(getattr(Image, "Palette", Image), "ADAPTIVE")
        quantized = sample.convert("P", palette=palette_adaptive, colors=max(4, int(palette_size)))
        palette = quantized.getpalette() or []
        counts = quantized.getcolors() or []
        total = sum(c for c, _ in counts) or 1
        grouped: dict[str, dict[str, Any]] = {}

        for count, color_idx in sorted(counts, reverse=True):
            base = color_idx * 3
            rgb = tuple(palette[base : base + 3])
            if len(rgb) != 3:
                continue
            _, sat, light = self._rgb_to_hsl(rgb)
            label = self._describe_color_name(rgb)
            if label not in grouped:
                grouped[label] = {
                    "name": label,
                    "count": 0,
                    "r_sum": 0.0,
                    "g_sum": 0.0,
                    "b_sum": 0.0,
                    "sat_sum": 0.0,
                    "light_sum": 0.0,
                    "peak_score": -1.0,
                    "peak_rgb": [int(rgb[0]), int(rgb[1]), int(rgb[2])],
                }
            entry = grouped[label]
            entry["count"] += int(count)
            entry["r_sum"] += float(rgb[0]) * float(count)
            entry["g_sum"] += float(rgb[1]) * float(count)
            entry["b_sum"] += float(rgb[2]) * float(count)
            entry["sat_sum"] += float(sat) * float(count)
            entry["light_sum"] += float(light) * float(count)
            chroma_bias = max(0.0, 1.0 - abs(float(light) - 0.52))
            peak_score = (float(sat) * 4.0) + (chroma_bias * 1.15) + (float(light) * 0.2)
            if peak_score > float(entry.get("peak_score", -1.0)):
                entry["peak_score"] = peak_score
                entry["peak_rgb"] = [int(rgb[0]), int(rgb[1]), int(rgb[2])]

        return grouped, total

    def _build_color_payload(self, row: dict[str, Any], total: int, prefer_peak: bool = True) -> dict[str, Any]:
        count = max(1, int(row.get("count", 1)))
        avg_rgb = [
            int(round(float(row.get("r_sum", 0.0)) / count)),
            int(round(float(row.get("g_sum", 0.0)) / count)),
            int(round(float(row.get("b_sum", 0.0)) / count)),
        ]
        peak_rgb_raw = row.get("peak_rgb", avg_rgb)
        rgb = avg_rgb
        if (
            prefer_peak
            and isinstance(peak_rgb_raw, list)
            and len(peak_rgb_raw) == 3
            and all(isinstance(v, (int, float)) for v in peak_rgb_raw)
        ):
            rgb = [int(peak_rgb_raw[0]), int(peak_rgb_raw[1]), int(peak_rgb_raw[2])]
        percent = round((count / max(1, total)) * 100, 2)
        name = str(row.get("name", ""))
        if prefer_peak:
            name = self._describe_color_name((int(rgb[0]), int(rgb[1]), int(rgb[2])))
        return {
            "name": name,
            "rgb": rgb,
            "percent": percent,
        }

    def _rgb_to_hsl(self, rgb: tuple[int, int, int]) -> tuple[float, float, float]:
        r = rgb[0] / 255.0
        g = rgb[1] / 255.0
        b = rgb[2] / 255.0
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        delta = max_c - min_c
        light = (max_c + min_c) / 2.0

        if delta == 0.0:
            sat = 0.0
        else:
            sat = delta / (1.0 - abs(2.0 * light - 1.0))

        hue = 0.0
        if delta != 0.0:
            if max_c == r:
                hue = ((g - b) / delta) % 6.0
            elif max_c == g:
                hue = ((b - r) / delta) + 2.0
            else:
                hue = ((r - g) / delta) + 4.0
            hue *= 60.0

        return hue, sat, light

    def _rgb_to_lab(self, rgb: tuple[int, int, int]) -> tuple[float, float, float]:
        def _to_linear(channel: int) -> float:
            val = max(0.0, min(1.0, float(channel) / 255.0))
            if val <= 0.04045:
                return val / 12.92
            return ((val + 0.055) / 1.055) ** 2.4

        r = _to_linear(rgb[0])
        g = _to_linear(rgb[1])
        b = _to_linear(rgb[2])

        x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100.0
        y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100.0
        z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100.0

        xn = 95.047
        yn = 100.0
        zn = 108.883

        def _pivot(value: float) -> float:
            ratio = value / 100.0
            if ratio > 0.008856:
                return ratio ** (1.0 / 3.0)
            return (7.787 * ratio) + (16.0 / 116.0)

        fx = _pivot((x / xn) * 100.0)
        fy = _pivot((y / yn) * 100.0)
        fz = _pivot((z / zn) * 100.0)

        l = max(0.0, (116.0 * fy) - 16.0)
        a = 500.0 * (fx - fy)
        lab_b = 200.0 * (fy - fz)
        return l, a, lab_b

    def _lab_distance(self, lab_a: tuple[float, float, float], lab_b: tuple[float, float, float]) -> float:
        dl = lab_a[0] - lab_b[0]
        da = lab_a[1] - lab_b[1]
        db = lab_a[2] - lab_b[2]
        return math.sqrt((dl * dl) + (da * da) + (db * db))

    def _nearest_color_anchor(self, rgb: tuple[int, int, int]) -> str:
        hue, sat, light = self._rgb_to_hsl(rgb)
        if light <= 0.08:
            return "black"
        if sat <= 0.08:
            if light < 0.22:
                return "black"
            if light < 0.80:
                return "gray"
            return "white"

        lab = self._rgb_to_lab(rgb)
        best_name = "gray"
        best_distance = float("inf")
        prefer_chromatic = sat >= 0.14
        for name, _anchor_rgb, anchor_lab in self._color_anchor_lab:
            if prefer_chromatic and name in {"black", "gray", "white"}:
                continue
            dist = self._lab_distance(lab, anchor_lab)
            if name in {"black", "gray", "white"}:
                # As chroma increases, keep labels in a chromatic family.
                dist += sat * 85.0
                if name == "white" and light < 0.7:
                    dist += (0.7 - light) * 45.0
                if name == "black" and light > 0.25:
                    dist += (light - 0.25) * 55.0
            if dist < best_distance:
                best_distance = dist
                best_name = name

        # Warm calibration to avoid yellow/orange flips in pale regions.
        if 18.0 <= hue <= 75.0:
            if sat < 0.28 and light >= 0.56:
                return "yellow"
            if sat >= 0.36 and hue < 42.0:
                return "orange"
            if hue >= 42.0:
                return "yellow"

        if best_name == "brown" and sat >= 0.52 and light >= 0.42 and 12.0 <= hue <= 45.0:
            return "orange"
        if best_name == "orange" and light >= 0.68 and sat < 0.34 and hue >= 40.0:
            return "yellow"

        # If a pastel/tinted hue still lands on neutral, force hue family.
        if best_name in {"white", "gray"} and sat >= 0.1:
            if hue < 15.0 or hue >= 345.0:
                return "red"
            if hue < 45.0:
                return "orange"
            if hue < 75.0:
                return "yellow"
            if hue < 165.0:
                return "green"
            if hue < 250.0:
                return "blue"
            if hue < 330.0:
                return "purple"
            return "pink"

        return best_name

    def _color_family_from_rgb(self, rgb: tuple[int, int, int]) -> str:
        name = self._nearest_color_anchor(rgb)
        if name in {"black", "gray", "white"}:
            return "neutral"
        if name in {"red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown"}:
            return name
        return "neutral"

    def _is_near_black_chromatic(self, rgb: tuple[int, int, int]) -> bool:
        _, sat, light = self._rgb_to_hsl(rgb)
        if light >= 0.22:
            return False
        if sat >= 0.85:
            return False
        family = self._color_family_from_rgb(rgb)
        return family != "neutral"

    def _is_neutral_color_label(self, label: str) -> bool:
        text = str(label or "").lower().strip()
        if not text:
            return True
        neutral_tokens = ("gray", "grey", "white", "black", "brown", "tan", "charcoal")
        return any(token in text for token in neutral_tokens)

    def _describe_color_name(self, rgb: tuple[int, int, int]) -> str:
        return self._nearest_color_anchor(rgb)

    def _extract_actions(self, description: str) -> list[str]:
        desc = description.lower()
        actions = [name for name, pattern in ACTION_PATTERNS.items() if re.search(pattern, desc)]
        return actions

    def _category_match_forms(self, text: str) -> set[str]:
        clean = _term_key(text)
        if not clean:
            return set()

        forms: set[str] = {clean, clean.replace("-", " ")}
        tokens = [token for token in re.findall(r"[a-z0-9]+", clean) if token]
        if not tokens:
            return forms

        singulars: list[str] = []
        for token in tokens:
            singular = token
            if token.endswith("ies") and len(token) > 4:
                singular = f"{token[:-3]}y"
            elif token.endswith("s") and len(token) > 4 and token not in {"glass", "grass", "class"}:
                singular = token[:-1]
            singulars.append(singular)
            forms.add(token)
            forms.add(singular)

        singular_phrase = " ".join(singulars).strip()
        if singular_phrase:
            forms.add(singular_phrase)

        return {item for item in forms if item}

    def _categorize_image(self, description: str, objects: list[str], actions: list[str]) -> list[str]:
        desc = self._sanitize_caption(str(description or ""))
        desc_key = _term_key(desc)

        object_terms = [
            self._normalize_object_label(str(obj or ""))
            for obj in (objects or [])
            if str(obj or "").strip()
        ]
        action_terms = [str(action or "").strip().lower() for action in (actions or []) if str(action or "").strip()]
        noun_terms = self._noun_terms_from_description(desc)
        desc_object_terms = self._objects_from_description(desc)
        library_terms = self._objects_from_object_library(desc)

        signal_terms: set[str] = set()
        for source in [*object_terms, *action_terms, *noun_terms, *desc_object_terms, *library_terms]:
            signal_terms.update(self._category_match_forms(source))

        desc_tokens = {
            form
            for token in re.findall(r"[a-z0-9-]+", desc_key)
            for form in self._category_match_forms(token)
        }

        scores: dict[str, float] = {}
        for category, keywords in CATEGORY_KEYWORD_RULES.items():
            score = 0.0
            for keyword in keywords:
                matched = False
                for form in self._category_match_forms(keyword):
                    if not form:
                        continue
                    if form in signal_terms:
                        score += 1.35
                        matched = True
                        break
                    if " " in form:
                        if desc_key and re.search(rf"\b{re.escape(form)}\b", desc_key):
                            score += 1.0
                            matched = True
                            break
                    elif form in desc_tokens:
                        score += 0.8
                        matched = True
                        break
                if matched:
                    continue
            if score > 0:
                scores[category] = score

        # Photographs vs illustrations are high-level buckets users can sort by quickly.
        if re.search(r"\b(photo|photograph|realistic|camera)\b", desc_key):
            scores["photography"] = scores.get("photography", 0.0) + 2.0
        if re.search(r"\b(illustration|drawing|painting|cartoon|anime|render)\b", desc_key):
            scores["illustration"] = scores.get("illustration", 0.0) + 2.0

        ranked = sorted(
            scores.items(),
            key=lambda row: (row[1], len(row[0])),
            reverse=True,
        )
        if not ranked:
            return []
        return [name for name, _score in ranked[:4]]

    def _estimate_confidence(
        self,
        description: str,
        objects: list[str],
        actions: list[str],
        categories: list[str],
        colors: list[dict[str, Any]],
    ) -> dict[str, float]:
        desc_words = re.findall(r"[a-z][a-z-]{2,}", str(description or "").lower())
        description_conf = min(1.0, max(0.0, len(desc_words) / 14.0))
        keyword_conf = min(1.0, max(0.0, len(objects or []) / 6.0))
        actions_conf = 0.9 if (actions or []) else 0.45
        categories_conf = min(1.0, max(0.0, len(categories or []) / 3.0))
        colors_conf = min(1.0, max(0.0, len(colors or []) / 5.0))
        overall = (description_conf * 0.34) + (keyword_conf * 0.24) + (actions_conf * 0.1) + (categories_conf * 0.16) + (colors_conf * 0.16)
        return {
            "description": round(description_conf, 3),
            "keywords": round(keyword_conf, 3),
            "actions": round(actions_conf, 3),
            "categories": round(categories_conf, 3),
            "colors": round(colors_conf, 3),
            "overall": round(overall, 3),
        }

    def _normalize_ip_risk(self, ip_risk: dict[str, Any] | None) -> dict[str, Any]:
        if not isinstance(ip_risk, dict):
            return {"level": "none", "score": 0.0, "matches": []}
        level = str(ip_risk.get("level", "none")).strip().lower()
        if level not in IP_RISK_LEVELS:
            level = "none"
        score = 0.0
        try:
            raw_score = float(ip_risk.get("score", 0.0))
            if math.isfinite(raw_score):
                score = max(0.0, min(1.0, raw_score))
        except Exception:
            score = 0.0
        matches_raw = ip_risk.get("matches", [])
        if isinstance(matches_raw, list):
            matches = _dedupe_casefold([str(item).strip() for item in matches_raw if str(item).strip()])[:20]
        else:
            matches = []
        reason = str(ip_risk.get("reason", "")).strip()
        out: dict[str, Any] = {"level": level, "score": round(score, 3), "matches": matches}
        if reason:
            out["reason"] = reason
        return out

    def _normalize_ip_text(self, text: str) -> str:
        normalized = str(text or "").strip().lower()
        if not normalized:
            return ""
        normalized = normalized.replace("_", " ")
        normalized = re.sub(r"[-/]+", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        for source, target in IP_RISK_TEXT_NORMALIZATIONS.items():
            pattern = rf"\b{re.escape(source)}\b"
            normalized = re.sub(pattern, target, normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized

    def _ip_has_fuzzy_token(self, target: str, token_pool: set[str]) -> bool:
        if target in token_pool:
            return True
        if len(target) < 5:
            return False
        for candidate in token_pool:
            if candidate == target:
                return True
            if not candidate:
                continue
            if candidate[0] != target[0]:
                continue
            if abs(len(candidate) - len(target)) > 1:
                continue
            if self._bounded_levenshtein(candidate, target, max_distance=1) is not None:
                return True
        return False

    def _ip_alias_matches(
        self,
        alias: str,
        token_pool: set[str],
        bigrams: set[str],
        trigrams: set[str],
        compact_text: str,
    ) -> bool:
        normalized = re.sub(r"[^a-z0-9\s]+", " ", str(alias or "").lower())
        normalized = re.sub(r"\s+", " ", normalized).strip()
        if not normalized:
            return False

        alias_tokens = [part for part in normalized.split(" ") if part]
        if not alias_tokens:
            return False
        phrase = " ".join(alias_tokens)

        if len(alias_tokens) == 1 and alias_tokens[0] in token_pool:
            return True
        if len(alias_tokens) == 2 and phrase in bigrams:
            return True
        if len(alias_tokens) >= 3 and phrase in trigrams:
            return True

        compact_alias = "".join(alias_tokens)
        if compact_alias and len(compact_alias) >= 6 and compact_alias in compact_text:
            return True

        # Fuzzy fallback for slight misspellings (e.g. "dart vader" -> "darth vader").
        if len(alias_tokens) <= 3 and all(self._ip_has_fuzzy_token(token, token_pool) for token in alias_tokens):
            return True

        return False

    def _prune_overlapping_ip_aliases(self, aliases: list[str]) -> list[str]:
        if not aliases:
            return []
        unique = _dedupe_casefold([str(alias or "").strip().lower() for alias in aliases if str(alias or "").strip()])
        ranked = sorted(unique, key=lambda alias: (len(alias), alias.count(" ")), reverse=True)
        kept: list[str] = []
        for alias in ranked:
            # Avoid counting both phrase and contained token aliases as separate evidence.
            if any(alias == existing or alias in existing for existing in kept):
                continue
            kept.append(alias)
        return kept

    def _ip_risk_from_metadata(self, image_path: Path, metadata: ImageMetadata) -> dict[str, Any]:
        terms: list[str] = [
            str(metadata.description or ""),
            *[str(item or "") for item in metadata.objects],
            *[str(item or "") for item in metadata.actions],
            *[str(item or "") for item in metadata.categories],
            *[str(item or "") for item in metadata.custom_tags],
            image_path.stem,
        ]
        text = " ".join(part for part in terms if part).strip()
        text = self._correct_caption_spelling(text)
        text = self._normalize_ip_text(text)
        tokens = [tok for tok in re.findall(r"[a-z0-9]+", text) if tok]
        token_pool = set(tokens)
        bigrams = {" ".join(tokens[i : i + 2]) for i in range(max(0, len(tokens) - 1))}
        trigrams = {" ".join(tokens[i : i + 3]) for i in range(max(0, len(tokens) - 2))}
        compact_text = "".join(tokens)

        matches: list[str] = []
        alias_evidence: dict[str, list[str]] = {}
        score = 0.0
        for entity, aliases in IP_RISK_ENTITY_TERMS.items():
            found_aliases: list[str] = []
            for alias in aliases:
                if self._ip_alias_matches(alias, token_pool, bigrams, trigrams, compact_text):
                    found_aliases.append(str(alias).strip().lower())
            found_aliases = self._prune_overlapping_ip_aliases(found_aliases)
            context_hits: list[str] = []
            context_clues = IP_RISK_CONTEXT_CLUES.get(entity, set())
            if context_clues:
                for clue in context_clues:
                    if self._ip_alias_matches(clue, token_pool, bigrams, trigrams, compact_text):
                        context_hits.append(str(clue).strip().lower())
                context_hits = self._prune_overlapping_ip_aliases(context_hits)
            context_min_hits = max(1, int(IP_RISK_CONTEXT_MIN_HITS.get(entity, 2)))
            has_context_match = len(context_hits) >= context_min_hits

            if not found_aliases and not has_context_match:
                continue

            matches.append(entity)
            merged_evidence = self._prune_overlapping_ip_aliases(found_aliases + context_hits)
            alias_evidence[entity] = merged_evidence[:6]

            if found_aliases:
                has_phrase = any(" " in alias for alias in found_aliases)
                entity_score = 0.3
                if has_phrase:
                    entity_score += 0.14
                else:
                    entity_score += 0.08
                if len(found_aliases) >= 2:
                    entity_score += 0.04
                if len(found_aliases) >= 3 and has_phrase:
                    entity_score += 0.03
                if context_hits:
                    entity_score += min(0.12, 0.04 * float(len(context_hits)))
            else:
                # Context-only match path for franchise-specific cues
                # (e.g. "hogwarts", "quidditch", "007") when the direct
                # franchise title is absent.
                entity_score = 0.22 + min(0.16, 0.05 * float(len(context_hits)))

            score += min(0.62, entity_score)

        hint_matches = 0
        for hint in IP_RISK_HINT_TERMS:
            pattern = rf"\b{re.escape(hint.lower())}\b"
            if re.search(pattern, text):
                hint_matches += 1
        if hint_matches:
            score += min(0.28, 0.08 * float(hint_matches))

        level = "none"
        # Explicit known-IP entity hits should never be treated as "low".
        if len(matches) >= 2 or score >= 0.82:
            level = "high"
        elif len(matches) >= 1 or score >= 0.38:
            level = "medium"
        elif score >= 0.14 or hint_matches > 0:
            level = "low"

        reason = ""
        if level != "none":
            reason_parts: list[str] = []
            if matches:
                reason_parts.append(f"matched terms: {', '.join(matches[:6])}")
            if matches:
                evidence_parts: list[str] = []
                for entity in matches[:3]:
                    entity_hits = alias_evidence.get(entity, [])
                    if entity_hits:
                        evidence_parts.append(f"{entity} via {', '.join(entity_hits[:2])}")
                if evidence_parts:
                    reason_parts.append("evidence: " + "; ".join(evidence_parts))
            if hint_matches:
                reason_parts.append(f"ip hints: {hint_matches}")
            reason = "; ".join(reason_parts)
        return {
            "level": level,
            "score": round(max(0.0, min(1.0, score)), 3),
            "matches": matches[:20],
            "reason": reason,
        }

    def check_ip_risk_fast(
        self,
        image_path: Path,
        metadata: ImageMetadata,
    ) -> tuple[ImageMetadata, bool]:
        current = ImageMetadata.from_dict(
            {
                "description": metadata.description,
                "colors": metadata.colors,
                "actions": metadata.actions,
                "objects": metadata.objects,
                "custom_tags": metadata.custom_tags,
                "categories": metadata.categories,
                "confidence": metadata.confidence,
                "ip_risk": metadata.ip_risk,
            }
        )
        old_ip = self._normalize_ip_risk(current.ip_risk)
        new_ip = self._normalize_ip_risk(self._ip_risk_from_metadata(image_path, current))
        corrected = ImageMetadata(
            description=current.description,
            colors=current.colors,
            actions=current.actions,
            objects=current.objects,
            custom_tags=current.custom_tags,
            categories=current.categories,
            confidence=current.confidence,
            ip_risk=new_ip,
        )
        changed = json.dumps(old_ip, sort_keys=True) != json.dumps(new_ip, sort_keys=True)
        return corrected, changed

    def _description_looks_invalid(self, description: str, source_name: str = "") -> bool:
        text = str(description or "").strip()
        if not text:
            return True
        if re.search(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b", text, re.IGNORECASE):
            return True
        if re.search(r"--profile|job id|--v[_ -]?\d+|run\d+", text, re.IGNORECASE):
            return True
        if re.search(r"\b([a-z-]{2,})(?:\s*(?:[,;:/|]\s*|\s+)\1\b){1,}", text, re.IGNORECASE):
            return True
        if re.search(r"\b((?:[a-z-]+\s+){1,2}[a-z-]+)(?:\s*(?:[,;:/|]\s*|\s+)\1\b){1,}", text, re.IGNORECASE):
            return True
        if source_name:
            stem = Path(str(source_name)).stem.lower()
            stem_key = re.sub(r"[^a-z0-9]+", " ", stem).strip()
            text_key = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
            if stem_key and text_key and (stem_key in text_key or text_key in stem_key):
                return True
        return False

    def _fallback_description(self, objects: list[str], categories: list[str], actions: list[str]) -> str:
        if objects:
            head = ", ".join(objects[:3])
            return f"an image of {head}."
        if categories:
            return f"an image in the {categories[0]} category."
        if actions:
            return f"an image showing {actions[0]}."
        return ""

    def check_metadata_fast(
        self,
        image_path: Path,
        metadata: ImageMetadata,
    ) -> tuple[ImageMetadata, list[str], list[str], bool]:
        current = ImageMetadata.from_dict(
            {
                "description": metadata.description,
                "colors": metadata.colors,
                "actions": metadata.actions,
                "objects": metadata.objects,
                "custom_tags": metadata.custom_tags,
                "categories": metadata.categories,
                "confidence": metadata.confidence,
                "ip_risk": metadata.ip_risk,
            }
        )

        issues: list[str] = []
        missing: list[str] = []

        source_description = str(current.description or "").strip()
        description = self._sanitize_caption(current.description)
        description = self._correct_caption_spelling(description)
        description = self._sanitize_caption(description)
        if description and source_description and description != source_description:
            issues.append("description normalized")

        normalized_objects: list[str] = []
        for item in current.objects:
            clean = self._normalize_object_label(item)
            if clean:
                normalized_objects.append(clean)
        cleaned_objects = self._prune_generic_labels(_dedupe_casefold(normalized_objects))
        cleaned_actions = _dedupe_casefold([str(item).strip().lower() for item in current.actions if str(item).strip()])
        cleaned_custom_tags = _dedupe_casefold([str(item).strip() for item in current.custom_tags if str(item).strip()])
        cleaned_categories = _extract_categories_from_terms(current.categories)

        description_invalid = bool(description) and self._description_looks_invalid(description, image_path.name)
        if description_invalid:
            issues.append("description invalid")

        if not description or description_invalid:
            fallback = self._fallback_description(cleaned_objects, cleaned_categories, cleaned_actions)
            if fallback:
                description = fallback
                issues.append("description corrected")
            else:
                description = ""
                missing.append("description")

        if not cleaned_objects and description:
            guessed_objects = self._prune_generic_labels(
                _dedupe_casefold(self._objects_from_description(description) + self._noun_terms_from_description(description))
            )[:12]
            if guessed_objects:
                cleaned_objects = guessed_objects
                issues.append("keywords added")
            else:
                missing.append("keywords")
        elif not cleaned_objects:
            missing.append("keywords")

        inferred_actions = self._extract_actions(description) if description else []
        if not cleaned_actions and inferred_actions:
            cleaned_actions = inferred_actions
            issues.append("actions added")
        elif not cleaned_actions:
            missing.append("actions")

        inferred_categories = self._categorize_image(description, cleaned_objects, cleaned_actions)
        if not cleaned_categories and inferred_categories:
            cleaned_categories = inferred_categories
            issues.append("categories added")
        elif not cleaned_categories:
            missing.append("categories")
        else:
            if inferred_categories:
                current_set = {c.lower() for c in cleaned_categories}
                inferred_set = {c.lower() for c in inferred_categories}
                if current_set != inferred_set:
                    cleaned_categories = inferred_categories
                    issues.append("categories corrected")

        current_colors = self._dedupe_color_payloads(current.colors)
        current_color_rows = [row for row in current.colors if isinstance(row, dict)]
        current_had_redundant_colors = len(current_colors) < len(current_color_rows)
        cleaned_colors = current_colors
        if current_had_redundant_colors and cleaned_colors:
            issues.append("colors deduplicated")
        # Throughput optimization for massive repair/check runs:
        # only open the image when colors are missing and need to be backfilled.
        if not cleaned_colors:
            try:
                with Image.open(image_path) as raw:
                    image = raw.convert("RGB")
                inferred_colors = self._dedupe_color_payloads(self._extract_dominant_colors(image, fast_mode=True))
            except Exception:
                inferred_colors = []
            if inferred_colors:
                cleaned_colors = inferred_colors
                issues.append("colors added")
            else:
                missing.append("colors")

        corrected = ImageMetadata(
            description=description,
            colors=cleaned_colors,
            actions=cleaned_actions,
            objects=cleaned_objects,
            custom_tags=cleaned_custom_tags,
            categories=cleaned_categories,
            confidence=self._estimate_confidence(
                description=description,
                objects=cleaned_objects,
                actions=cleaned_actions,
                categories=cleaned_categories,
                colors=cleaned_colors,
            ),
            ip_risk=current.ip_risk,
        )
        if float(corrected.confidence.get("categories", 0.0)) < 0.45:
            issues.append("low-confidence-categories")
        if float(corrected.confidence.get("overall", 0.0)) < 0.5:
            issues.append("low-confidence-metadata")
        changed = corrected.to_json() != current.to_json()
        missing = _dedupe_casefold([field for field in missing if field in MISSING_METADATA_FIELDS])
        return corrected, _dedupe_casefold(issues), missing, changed


def find_images(folder: Path) -> list[Path]:
    return sorted(
        [
            path
            for path in folder.rglob("*")
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
    )


def write_metadata_to_file(image_path: Path, metadata: ImageMetadata) -> None:
    suffix = image_path.suffix.lower()
    payload = metadata.to_json()

    if suffix == ".png":
        _write_png_metadata(image_path, metadata, payload)
        return

    if suffix in {".jpg", ".jpeg", ".tif", ".tiff", ".webp"}:
        _write_exif_metadata(image_path, metadata, payload)
        if suffix in {".jpg", ".jpeg"}:
            _write_jpeg_xmp_metadata(image_path, metadata)
        return

    raise ValueError(f"Unsupported format for metadata write: {image_path.suffix}")


def remove_metadata_from_file(image_path: Path) -> None:
    suffix = image_path.suffix.lower()
    if suffix == ".png":
        _remove_png_metadata(image_path)
        return
    if suffix in {".jpg", ".jpeg", ".tif", ".tiff", ".webp"}:
        _remove_exif_metadata(image_path)
        if suffix in {".jpg", ".jpeg"}:
            _remove_jpeg_xmp_metadata(image_path)
        return
    raise ValueError(f"Unsupported format for metadata removal: {image_path.suffix}")


def write_metadata_to_bytes(image_bytes: bytes, suffix: str, metadata: ImageMetadata) -> bytes:
    ext = suffix.lower().strip()
    if not ext.startswith("."):
        ext = f".{ext}"
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {suffix}")

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
            temp_file.write(image_bytes)
            temp_path = Path(temp_file.name)
        write_metadata_to_file(temp_path, metadata)
        return temp_path.read_bytes()
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def remove_metadata_from_bytes(image_bytes: bytes, suffix: str) -> bytes:
    ext = suffix.lower().strip()
    if not ext.startswith("."):
        ext = f".{ext}"
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {suffix}")

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
            temp_file.write(image_bytes)
            temp_path = Path(temp_file.name)
        remove_metadata_from_file(temp_path)
        return temp_path.read_bytes()
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def read_metadata_from_file(image_path: Path) -> ImageMetadata | None:
    suffix = image_path.suffix.lower()
    if suffix == ".png":
        return _read_png_metadata(image_path)
    if suffix in {".jpg", ".jpeg", ".tif", ".tiff", ".webp"}:
        return _read_exif_metadata(image_path)
    raise ValueError(f"Unsupported format for metadata read: {image_path.suffix}")


def read_metadata_from_bytes(image_bytes: bytes, suffix: str) -> ImageMetadata | None:
    ext = suffix.lower().strip()
    if not ext.startswith("."):
        ext = f".{ext}"
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {suffix}")

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
            temp_file.write(image_bytes)
            temp_path = Path(temp_file.name)
        return read_metadata_from_file(temp_path)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def _split_metadata_terms(text: str) -> list[str]:
    if not text:
        return []
    return [part.strip() for part in re.split(r"[;,\n|]+", text) if part.strip()]


def _dedupe_casefold(items: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in items:
        text = str(raw).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _metadata_color_names(colors: list[dict[str, Any]]) -> list[str]:
    names: list[str] = []
    for row in colors:
        if not isinstance(row, dict):
            continue
        text = str(row.get("name", "")).strip()
        if text:
            names.append(text)
    return _dedupe_casefold(names)


def _metadata_keyword_terms(metadata: ImageMetadata) -> list[str]:
    raw_terms = [
        *metadata.custom_tags,
        *metadata.categories,
        *metadata.objects,
        *metadata.actions,
        *_metadata_color_names(metadata.colors),
    ]
    return _dedupe_casefold(raw_terms)[:80]


def _metadata_subject_text(metadata: ImageMetadata) -> str:
    subject_terms = _dedupe_casefold(
        [
            *metadata.categories,
            *metadata.objects,
            *metadata.actions,
        ]
    )
    return ", ".join(subject_terms[:18])


def _metadata_comment_text(metadata: ImageMetadata) -> str:
    actions = ", ".join(_dedupe_casefold(metadata.actions)[:20]) if metadata.actions else "none"
    comment_parts = [f"actions: {actions}"]
    ip_risk_text = _metadata_ip_risk_text(metadata)
    if ip_risk_text:
        comment_parts.append(f"ip risk: {ip_risk_text}")
    return "; ".join(comment_parts)


def _metadata_ip_risk_text(metadata: ImageMetadata) -> str:
    if not isinstance(metadata.ip_risk, dict):
        return ""
    level = str(metadata.ip_risk.get("level", "none")).strip().lower()
    if level not in IP_RISK_LEVELS:
        level = "none"
    score_text = ""
    try:
        score = float(metadata.ip_risk.get("score", 0.0))
        if math.isfinite(score):
            score_text = f"{max(0.0, min(1.0, score)) * 100:.0f}%"
    except Exception:
        score_text = ""
    matches_raw = metadata.ip_risk.get("matches", [])
    matches = _dedupe_casefold([str(item).strip() for item in matches_raw if str(item).strip()]) if isinstance(matches_raw, list) else []
    reason = str(metadata.ip_risk.get("reason", "")).strip()

    parts = [level]
    if score_text:
        parts.append(score_text)
    if matches:
        parts.append(", ".join(matches[:10]))
    if reason:
        parts.append(reason)
    return " | ".join(parts)


def _metadata_exif_title_text(metadata: ImageMetadata) -> str:
    return ", ".join(_dedupe_casefold(metadata.objects)[:24])


def _metadata_exif_subject_text(metadata: ImageMetadata) -> str:
    return ", ".join(_extract_categories_from_terms(metadata.categories)[:24])


def _metadata_exif_keywords_text(metadata: ImageMetadata) -> str:
    terms = _dedupe_casefold(
        [
            *metadata.custom_tags,
            *_metadata_color_names(metadata.colors),
        ]
    )
    # Keep a non-empty keywords field for search/indexing compatibility.
    if not terms:
        terms = _metadata_keyword_terms(metadata)
    return ";".join(terms[:80])


def _xml_escape(text: str) -> str:
    raw = str(text or "")
    return (
        raw.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _metadata_xmp_subject_terms(metadata: ImageMetadata) -> list[str]:
    terms = _dedupe_casefold(
        [
            *metadata.objects,
            *metadata.actions,
            *metadata.categories,
            *metadata.custom_tags,
            *_metadata_color_names(metadata.colors),
        ]
    )
    return terms[:80]


def _metadata_xmp_payload(metadata: ImageMetadata) -> bytes:
    description = _xml_escape(metadata.description.strip())
    subject_terms = _metadata_xmp_subject_terms(metadata)
    subject_xml = "".join(f"<rdf:li>{_xml_escape(term)}</rdf:li>" for term in subject_terms)
    categories_xml = "".join(
        f"<rdf:li>{_xml_escape(term)}</rdf:li>" for term in _extract_categories_from_terms(metadata.categories)[:40]
    )
    ip_risk = metadata.ip_risk if isinstance(metadata.ip_risk, dict) else {}
    ip_risk_level = _xml_escape(str(ip_risk.get("level", "none")).strip().lower() or "none")
    ip_risk_score = ""
    try:
        score = float(ip_risk.get("score", 0.0))
        if math.isfinite(score):
            ip_risk_score = f"{max(0.0, min(1.0, score)):.4f}"
    except Exception:
        ip_risk_score = ""
    ip_risk_matches = ""
    matches_raw = ip_risk.get("matches", [])
    if isinstance(matches_raw, list):
        ip_risk_matches = _xml_escape(", ".join(_dedupe_casefold([str(item).strip() for item in matches_raw if str(item).strip()])[:20]))
    ip_risk_reason = _xml_escape(str(ip_risk.get("reason", "")).strip())
    packet = (
        '<?xpacket begin="\\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description rdf:about="" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:lr="http://ns.adobe.com/lightroom/1.0/" '
        'xmlns:xmp="http://ns.adobe.com/xap/1.0/" '
        'xmlns:imd="https://imagedescriber.app/ns/1.0/">'
        '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">'
        f"{description}"
        "</rdf:li></rdf:Alt></dc:description>"
        "<dc:subject><rdf:Bag>"
        f"{subject_xml}"
        "</rdf:Bag></dc:subject>"
        "<lr:hierarchicalSubject><rdf:Bag>"
        f"{categories_xml}"
        "</rdf:Bag></lr:hierarchicalSubject>"
        f"<xmp:Label>{_xml_escape(_metadata_exif_subject_text(metadata)[:120])}</xmp:Label>"
        f"<imd:ipRiskLevel>{ip_risk_level}</imd:ipRiskLevel>"
        f"<imd:ipRiskScore>{ip_risk_score}</imd:ipRiskScore>"
        f"<imd:ipRiskMatches>{ip_risk_matches}</imd:ipRiskMatches>"
        f"<imd:ipRiskReason>{ip_risk_reason}</imd:ipRiskReason>"
        "</rdf:Description></rdf:RDF></x:xmpmeta>"
        '<?xpacket end="w"?>'
    )
    return packet.encode("utf-8", "ignore")


def _normalize_category_label(text: str) -> str:
    clean = _term_key(text)
    if not clean:
        return ""
    aliases = {
        "people": "people",
        "person": "people",
        "animal": "animals",
        "animals": "animals",
        "wildlife": "wildlife",
        "nature": "nature",
        "mythology": "mythology",
        "mythological": "mythology",
        "futureistic": "futureistic",
        "futuristic": "futureistic",
        "textures": "textures",
        "texture": "textures",
        "architecture": "architecture",
        "building": "architecture",
        "vehicles": "vehicles",
        "vehicle": "vehicles",
        "transportation": "vehicles",
        "technology": "technology",
        "tech": "technology",
        "food": "food",
        "fantasy": "fantasy",
        "horror": "horror",
        "sci-fi": "sci-fi",
        "science fiction": "sci-fi",
        "scifi": "sci-fi",
        "sci fi": "sci-fi",
        "western": "western",
        "abstract": "abstract",
        "illustration": "illustration",
        "art": "illustration",
        "drawing": "illustration",
        "painting": "illustration",
        "photography": "photography",
        "photo": "photography",
    }
    return aliases.get(clean, clean)


def _extract_categories_from_terms(terms: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in terms:
        clean = _normalize_category_label(item)
        if not clean or clean in seen:
            continue
        seen.add(clean)
        out.append(clean)
    return out


def _looks_like_color_term(term: str) -> bool:
    token_set = set(re.findall(r"[a-z]+", term.lower()))
    color_words = {
        "black",
        "white",
        "gray",
        "grey",
        "red",
        "orange",
        "yellow",
        "green",
        "teal",
        "blue",
        "purple",
        "magenta",
        "brown",
        "tan",
        "charcoal",
        "light",
        "dark",
        "muted",
    }
    return bool(token_set & color_words) and any(
        base in token_set for base in {"black", "white", "gray", "grey", "red", "orange", "yellow", "green", "teal", "blue", "purple", "magenta", "brown", "tan"}
    )


def _term_key(text: str) -> str:
    clean = re.sub(r"[^a-z0-9\s-]", " ", str(text).lower())
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _split_objects_actions_from_terms(
    terms: list[str],
    object_hints: list[str] | None = None,
) -> tuple[list[str], list[str], list[str], list[str]]:
    objects: list[str] = []
    actions: list[str] = []
    colors: list[str] = []
    custom_tags: list[str] = []
    object_hint_keys = {_term_key(item) for item in (object_hints or []) if _term_key(item)}
    for term in _dedupe_casefold(terms):
        lower = term.lower()
        if lower in ACTION_PATTERNS:
            actions.append(term)
            continue
        if _looks_like_color_term(lower):
            colors.append(term)
            continue
        if object_hint_keys and _term_key(term) not in object_hint_keys:
            custom_tags.append(term)
            continue
        objects.append(term)
    return objects, actions, colors, custom_tags


def _extract_custom_tags_from_comment(comment_text: str) -> list[str]:
    if not comment_text:
        return []
    match = re.search(r"custom tags:\s*([^;]+)", comment_text, flags=re.IGNORECASE)
    if not match:
        return []
    raw = _split_metadata_terms(match.group(1).strip())
    return [term for term in raw if _term_key(term) not in {"none", "n a", "na", "null"}]


def _extract_categories_from_comment(comment_text: str) -> list[str]:
    if not comment_text:
        return []
    match = re.search(r"categories:\s*([^;]+)", comment_text, flags=re.IGNORECASE)
    if not match:
        return []
    raw = _split_metadata_terms(match.group(1).strip())
    cleaned = [term for term in raw if _term_key(term) not in {"none", "n a", "na", "null"}]
    return _extract_categories_from_terms(cleaned)


def _extract_actions_from_comment(comment_text: str) -> list[str]:
    if not comment_text:
        return []
    match = re.search(r"actions:\s*([^;]+)", comment_text, flags=re.IGNORECASE)
    if not match:
        return []
    raw = _split_metadata_terms(match.group(1).strip())
    return [term for term in _dedupe_casefold(raw) if _term_key(term) not in {"none", "n a", "na", "null"}]


def _extract_ip_risk_from_text(text: str) -> dict[str, Any]:
    if not text:
        return {}
    match = re.search(r"ip risk:\s*([^;]+)", text, flags=re.IGNORECASE)
    if not match:
        return {}
    payload = match.group(1).strip()
    parts = [part.strip() for part in payload.split("|") if part.strip()]
    if not parts:
        return {}
    out: dict[str, Any] = {}
    level = str(parts[0]).strip().lower()
    if level in IP_RISK_LEVELS:
        out["level"] = level
    if len(parts) >= 2 and re.fullmatch(r"\d+(?:\.\d+)?%", parts[1]):
        try:
            out["score"] = max(0.0, min(1.0, float(parts[1].rstrip("%")) / 100.0))
        except Exception:
            pass
    if len(parts) >= 3:
        matches = _dedupe_casefold([item.strip() for item in parts[2].split(",") if item.strip()])
        if matches:
            out["matches"] = matches[:20]
    if len(parts) >= 4:
        reason = parts[3].strip()
        if reason:
            out["reason"] = reason
    return out


def _write_png_metadata(image_path: Path, metadata: ImageMetadata, payload: str) -> None:
    keyword_terms = _metadata_keyword_terms(metadata)
    xmp_payload = _metadata_xmp_payload(metadata)
    with Image.open(image_path) as image:
        info = PngImagePlugin.PngInfo()
        existing_text = getattr(image, "text", {})
        for key, value in existing_text.items():
            if str(key) in MANAGED_PNG_TEXT_KEYS:
                continue
            info.add_text(str(key), str(value))

        info.add_text(PNG_METADATA_JSON_KEY, payload)
        info.add_text(PNG_METADATA_DESCRIPTION_KEY, metadata.description)
        info.add_text(PNG_METADATA_SUBJECT_KEY, _metadata_subject_text(metadata))
        info.add_text(PNG_METADATA_KEYWORDS_KEY, ";".join(keyword_terms))
        info.add_text(PNG_METADATA_COMMENT_KEY, _metadata_comment_text(metadata))
        info.add_text(PNG_METADATA_OBJECTS_KEY, ", ".join(metadata.objects))
        info.add_text(PNG_METADATA_ACTIONS_KEY, ", ".join(metadata.actions))
        info.add_text(PNG_METADATA_COLORS_KEY, ", ".join(_metadata_color_names(metadata.colors)))
        info.add_text(PNG_METADATA_CUSTOM_TAGS_KEY, ", ".join(metadata.custom_tags))
        info.add_text(PNG_METADATA_CATEGORIES_KEY, ", ".join(metadata.categories))
        info.add_text(PNG_METADATA_IP_RISK_KEY, _metadata_ip_risk_text(metadata))
        info.add_itxt(PNG_METADATA_XMP_KEY, xmp_payload.decode("utf-8", "ignore"))
        image.save(image_path, pnginfo=info)


def _remove_png_metadata(image_path: Path) -> None:
    with Image.open(image_path) as image:
        info = PngImagePlugin.PngInfo()
        existing_text = getattr(image, "text", {})
        for key, value in existing_text.items():
            if str(key) in MANAGED_PNG_TEXT_KEYS:
                continue
            info.add_text(str(key), str(value))
        image.save(image_path, pnginfo=info)


def _write_jpeg_xmp_metadata(image_path: Path, metadata: ImageMetadata) -> None:
    data = image_path.read_bytes()
    if len(data) < 4 or data[:2] != b"\xFF\xD8":
        return

    xmp_payload = _metadata_xmp_payload(metadata)
    segment_payload = XMP_JPEG_APP1_IDENTIFIER + xmp_payload
    if (len(segment_payload) + 2) > 0xFFFF:
        return
    xmp_segment = b"\xFF\xE1" + struct.pack(">H", len(segment_payload) + 2) + segment_payload

    output = bytearray(data[:2])
    pos = 2
    inserted = False

    while pos < len(data):
        if data[pos] != 0xFF:
            output.extend(data[pos:])
            break

        marker_start = pos
        while pos < len(data) and data[pos] == 0xFF:
            pos += 1
        if pos >= len(data):
            break

        marker = data[pos]
        pos += 1

        if marker in {0xD8, 0xD9} or (0xD0 <= marker <= 0xD7) or marker == 0x01:
            if marker == 0xD9 and not inserted:
                output.extend(xmp_segment)
                inserted = True
            output.extend(data[marker_start:pos])
            continue

        if pos + 2 > len(data):
            output.extend(data[marker_start:])
            break

        segment_len = int.from_bytes(data[pos : pos + 2], "big")
        if segment_len < 2:
            output.extend(data[marker_start:])
            break
        segment_end = pos + segment_len
        if segment_end > len(data):
            output.extend(data[marker_start:])
            break

        full_segment = data[marker_start:segment_end]
        segment_payload_bytes = data[pos + 2 : segment_end]

        if marker == 0xDA:  # Start Of Scan: write XMP right before scan data.
            if not inserted:
                output.extend(xmp_segment)
                inserted = True
            output.extend(full_segment)
            output.extend(data[segment_end:])
            break

        is_existing_xmp = marker == 0xE1 and segment_payload_bytes.startswith(XMP_JPEG_APP1_IDENTIFIER)
        if not is_existing_xmp:
            output.extend(full_segment)

        pos = segment_end

    if not inserted:
        if len(output) >= 2 and output[-2:] == b"\xFF\xD9":
            output = output[:-2] + xmp_segment + b"\xFF\xD9"
        else:
            output.extend(xmp_segment)

    if bytes(output) != data:
        image_path.write_bytes(bytes(output))


def _remove_jpeg_xmp_metadata(image_path: Path) -> None:
    data = image_path.read_bytes()
    if len(data) < 4 or data[:2] != b"\xFF\xD8":
        return

    output = bytearray(data[:2])
    pos = 2
    removed = False

    while pos < len(data):
        if data[pos] != 0xFF:
            output.extend(data[pos:])
            break

        marker_start = pos
        while pos < len(data) and data[pos] == 0xFF:
            pos += 1
        if pos >= len(data):
            break

        marker = data[pos]
        pos += 1

        if marker in {0xD8, 0xD9} or (0xD0 <= marker <= 0xD7) or marker == 0x01:
            output.extend(data[marker_start:pos])
            continue

        if pos + 2 > len(data):
            output.extend(data[marker_start:])
            break

        segment_len = int.from_bytes(data[pos : pos + 2], "big")
        if segment_len < 2:
            output.extend(data[marker_start:])
            break
        segment_end = pos + segment_len
        if segment_end > len(data):
            output.extend(data[marker_start:])
            break

        full_segment = data[marker_start:segment_end]
        segment_payload_bytes = data[pos + 2 : segment_end]

        if marker == 0xDA:
            output.extend(full_segment)
            output.extend(data[segment_end:])
            break

        is_xmp_segment = marker == 0xE1 and segment_payload_bytes.startswith(XMP_JPEG_APP1_IDENTIFIER)
        if is_xmp_segment:
            removed = True
        else:
            output.extend(full_segment)
        pos = segment_end

    if removed and bytes(output) != data:
        image_path.write_bytes(bytes(output))


def _read_png_metadata(image_path: Path) -> ImageMetadata | None:
    with Image.open(image_path) as image:
        text_data = dict(getattr(image, "text", {}))
        if not text_data:
            for key, value in (image.info or {}).items():
                if isinstance(value, str):
                    text_data[str(key)] = value

    payload = text_data.get(PNG_METADATA_JSON_KEY)
    if payload:
        try:
            parsed = json.loads(payload)
            if isinstance(parsed, dict):
                return ImageMetadata.from_dict(parsed)
        except Exception:
            pass

    comment_payload = str(text_data.get(PNG_METADATA_COMMENT_KEY, "")).strip()
    if comment_payload.startswith("{"):
        try:
            parsed = json.loads(comment_payload)
            if isinstance(parsed, dict):
                return ImageMetadata.from_dict(parsed)
        except Exception:
            pass

    description = str(
        text_data.get(PNG_METADATA_DESCRIPTION_KEY, "") or text_data.get("ImageDescription", "")
    ).strip()
    objects = _split_metadata_terms(str(text_data.get(PNG_METADATA_OBJECTS_KEY, "")).strip())
    actions = _split_metadata_terms(str(text_data.get(PNG_METADATA_ACTIONS_KEY, "")).strip())
    custom_tags = _split_metadata_terms(str(text_data.get(PNG_METADATA_CUSTOM_TAGS_KEY, "")).strip())
    categories = _extract_categories_from_terms(
        _split_metadata_terms(str(text_data.get(PNG_METADATA_CATEGORIES_KEY, "")).strip())
    )
    ip_risk = _extract_ip_risk_from_text(str(text_data.get(PNG_METADATA_IP_RISK_KEY, "")).strip())

    keyword_items = _split_metadata_terms(str(text_data.get(PNG_METADATA_KEYWORDS_KEY, "")).strip())
    if keyword_items:
        parsed_objects, parsed_actions, _, parsed_custom_tags = _split_objects_actions_from_terms(
            keyword_items,
            object_hints=objects,
        )
        if not objects:
            objects = parsed_objects
        if not actions:
            actions = parsed_actions
        if not custom_tags:
            custom_tags = parsed_custom_tags
        if not categories:
            categories = _extract_categories_from_terms(keyword_items)

    if not actions:
        actions = _extract_actions_from_comment(comment_payload)
    if not custom_tags:
        custom_tags = _extract_custom_tags_from_comment(comment_payload)
    if not categories:
        categories = _extract_categories_from_comment(comment_payload)
    if not ip_risk:
        ip_risk = _extract_ip_risk_from_text(comment_payload)

    if description or objects or actions or custom_tags or categories or ip_risk:
        return ImageMetadata(
            description=description,
            colors=[],
            actions=actions,
            objects=objects,
            custom_tags=custom_tags,
            categories=categories,
            ip_risk=ip_risk,
        )
    return None


def _empty_exif_dict() -> dict[str, Any]:
    return {"0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": None}


def _decode_exif_value(value: Any, encoding: str = "utf-8") -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        try:
            return value.decode(encoding, "ignore").strip("\x00 ").strip()
        except Exception:
            return ""
    if isinstance(value, (list, tuple)):
        try:
            return bytes(value).decode(encoding, "ignore").strip("\x00 ").strip()
        except Exception:
            return ""
    return str(value).strip()


def _decode_user_comment(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw.strip("\x00 ").strip()
    data = raw if isinstance(raw, bytes) else bytes(raw)
    if not data:
        return ""
    if data.startswith(b"UNICODE\x00"):
        return data[8:].decode("utf-16le", "ignore").strip("\x00 ").strip()
    if data.startswith(b"ASCII\x00\x00\x00"):
        return data[8:].decode("ascii", "ignore").strip("\x00 ").strip()
    try:
        return data.decode("utf-8", "ignore").strip("\x00 ").strip()
    except Exception:
        return data.decode("utf-16le", "ignore").strip("\x00 ").strip()


def _read_exif_metadata(image_path: Path) -> ImageMetadata | None:
    try:
        exif_dict = piexif.load(str(image_path))
    except Exception:
        return None

    zero = exif_dict.get("0th", {})
    exif_ifd = exif_dict.get("Exif", {})

    description = _decode_exif_value(zero.get(piexif.ImageIFD.ImageDescription), encoding="utf-8")

    title_text = _decode_exif_value(zero.get(EXIF_TAG_XP_TITLE), encoding="utf-16le")
    title_items = _split_metadata_terms(title_text)
    keywords_raw = zero.get(EXIF_TAG_XP_KEYWORDS)
    keywords_text = _decode_exif_value(keywords_raw, encoding="utf-16le")
    keyword_items = _split_metadata_terms(keywords_text)
    subject_text = _decode_exif_value(zero.get(EXIF_TAG_XP_SUBJECT), encoding="utf-16le")
    subject_items = _split_metadata_terms(subject_text)
    comment_text = _decode_exif_value(zero.get(EXIF_TAG_XP_COMMENT), encoding="utf-16le")
    comment_items = _split_metadata_terms(comment_text)
    comment_has_sections = bool(
        re.search(r"\b(categories|objects|actions|custom tags|colors)\s*:", comment_text, flags=re.IGNORECASE)
    )

    user_comment_raw = exif_ifd.get(piexif.ExifIFD.UserComment)
    user_comment = _decode_user_comment(user_comment_raw)
    if user_comment:
        try:
            parsed = json.loads(user_comment)
            if isinstance(parsed, dict):
                return ImageMetadata.from_dict(parsed)
        except Exception:
            pass

    if comment_text.startswith("{"):
        try:
            parsed = json.loads(comment_text)
            if isinstance(parsed, dict):
                return ImageMetadata.from_dict(parsed)
        except Exception:
            pass

    objects = _dedupe_casefold(title_items)
    actions: list[str] = []
    custom_tags: list[str] = []
    categories: list[str] = _extract_categories_from_terms(subject_items)
    if comment_items and not comment_has_sections:
        actions = _dedupe_casefold(comment_items)
    if keyword_items:
        parsed_objects, parsed_actions, _, parsed_custom_tags = _split_objects_actions_from_terms(
            keyword_items,
            object_hints=objects if objects else None,
        )
        if not objects:
            objects = parsed_objects
        if not actions:
            actions = parsed_actions
        custom_tags = parsed_custom_tags
        if not categories:
            categories = _extract_categories_from_terms(keyword_items)
    if not objects and subject_items:
        objects = _dedupe_casefold(subject_items)
    if not actions:
        actions = _extract_actions_from_comment(comment_text)
    custom_tags = _dedupe_casefold(custom_tags + _extract_custom_tags_from_comment(comment_text))
    categories = _dedupe_casefold(categories + _extract_categories_from_comment(comment_text))
    ip_risk = _extract_ip_risk_from_text(comment_text)

    if description or objects or actions or keyword_items or custom_tags or categories or ip_risk:
        return ImageMetadata(
            description=description,
            colors=[],
            actions=actions,
            objects=objects if objects else keyword_items,
            custom_tags=custom_tags,
            categories=categories,
            ip_risk=ip_risk,
        )
    return None


def _write_exif_metadata(image_path: Path, metadata: ImageMetadata, payload: str) -> None:
    try:
        exif_dict = piexif.load(str(image_path))
    except Exception:
        exif_dict = _empty_exif_dict()

    zero = exif_dict.setdefault("0th", {})
    exif_ifd = exif_dict.setdefault("Exif", {})

    description = metadata.description.strip()
    title = _metadata_exif_title_text(metadata)[:256]
    keywords = _metadata_exif_keywords_text(metadata)[:1800]
    subject = _metadata_exif_subject_text(metadata)[:1000]
    comment = _metadata_comment_text(metadata)[:1000]

    zero[piexif.ImageIFD.ImageDescription] = description[:1000].encode("utf-8", "ignore")
    zero[EXIF_TAG_XP_TITLE] = title.encode("utf-16le", "ignore")
    zero[EXIF_TAG_XP_SUBJECT] = subject.encode("utf-16le", "ignore")
    zero[EXIF_TAG_XP_KEYWORDS] = keywords.encode("utf-16le", "ignore")
    zero[EXIF_TAG_XP_COMMENT] = comment.encode("utf-16le", "ignore")

    # EXIF UserComment expects an encoding prefix. UNICODE + UTF-16LE content.
    exif_ifd[piexif.ExifIFD.UserComment] = b"UNICODE\x00" + payload.encode("utf-16le", "ignore")

    exif_bytes = piexif.dump(exif_dict)
    try:
        piexif.insert(exif_bytes, str(image_path))
    except Exception:
        with Image.open(image_path) as image:
            image.save(image_path, exif=exif_bytes)


def _remove_exif_metadata(image_path: Path) -> None:
    try:
        exif_dict = piexif.load(str(image_path))
    except Exception:
        exif_dict = _empty_exif_dict()

    zero = exif_dict.setdefault("0th", {})
    exif_ifd = exif_dict.setdefault("Exif", {})
    for tag in MANAGED_EXIF_ZERO_TAGS:
        zero.pop(tag, None)
    for tag in MANAGED_EXIF_EXIF_TAGS:
        exif_ifd.pop(tag, None)

    exif_bytes = piexif.dump(exif_dict)
    try:
        piexif.insert(exif_bytes, str(image_path))
    except Exception:
        with Image.open(image_path) as image:
            image.save(image_path, exif=exif_bytes)


def select_folder_via_dialog() -> Path | None:
    if tk is None or filedialog is None:
        return None
    root = tk.Tk()
    root.withdraw()
    root.update()
    selected = filedialog.askdirectory(title="Choose a folder of images to process")
    root.destroy()
    if not selected:
        return None
    return Path(selected)


def _metadata_has_skip_fields(metadata: ImageMetadata | None) -> bool:
    if metadata is None:
        return False
    objects = metadata.objects if isinstance(metadata.objects, list) else []
    categories = metadata.categories if isinstance(metadata.categories, list) else []
    return any(str(item).strip() for item in objects) or any(str(item).strip() for item in categories)


def _resolve_cli_checkpoint_paths(folder: Path, checkpoint_file: Path | None) -> tuple[Path, Path]:
    if checkpoint_file is not None:
        state_path = checkpoint_file.expanduser().resolve()
        done_path = state_path.with_suffix(f"{state_path.suffix}.done")
        return state_path, done_path
    return (
        folder / CLI_CHECKPOINT_STATE_FILENAME,
        folder / CLI_CHECKPOINT_DONE_FILENAME,
    )


def _load_cli_done_paths(done_path: Path) -> set[str]:
    if not done_path.exists():
        return set()
    out: set[str] = set()
    try:
        with done_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                text = line.strip()
                if text:
                    out.add(text)
    except Exception:
        return set()
    return out


def _append_cli_done_paths(done_path: Path, items: list[str]) -> None:
    if not items:
        return
    done_path.parent.mkdir(parents=True, exist_ok=True)
    with done_path.open("a", encoding="utf-8") as handle:
        for item in items:
            text = str(item).replace("\n", " ").strip()
            if not text:
                continue
            handle.write(f"{text}\n")


def _load_cli_checkpoint_state(state_path: Path) -> dict[str, Any] | None:
    if not state_path.exists():
        return None
    try:
        payload = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def _write_cli_checkpoint_state(state_path: Path, payload: dict[str, Any]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = state_path.with_suffix(f"{state_path.suffix}.tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
    temp_path.replace(state_path)


def _format_seconds_short(value: float) -> str:
    if not math.isfinite(value) or value < 0:
        return "--:--:--"
    total = int(round(value))
    hours, rem = divmod(total, 3600)
    minutes, seconds = divmod(rem, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _relative_path_key(path: Path, folder: Path) -> str:
    try:
        return path.relative_to(folder).as_posix()
    except Exception:
        return path.name


def _choose_cli_mp_context():
    try:
        if sys.platform in {"darwin", "win32"}:
            return mp.get_context("spawn")
        return mp.get_context("fork")
    except Exception:  # pragma: no cover
        return mp.get_context("spawn")


_CLI_WORKER_GENERATOR: VisionMetadataGenerator | None = None


def _cli_worker_get_generator() -> VisionMetadataGenerator:
    global _CLI_WORKER_GENERATOR
    if _CLI_WORKER_GENERATOR is None:
        generator = VisionMetadataGenerator()
        generator.load_models()
        _CLI_WORKER_GENERATOR = generator
    return _CLI_WORKER_GENERATOR


def _cli_worker_analyze_and_write(image_path_text: str, high_recall: bool, fast_mode: bool) -> tuple[bool, str]:
    try:
        image_path = Path(image_path_text)
        generator = _cli_worker_get_generator()
        metadata = generator.analyze_image(
            image_path,
            high_recall=bool(high_recall),
            fast_mode=bool(fast_mode),
        )
        write_metadata_to_file(image_path, metadata)
        return True, ""
    except Exception as exc:
        return False, str(exc)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate and write computer vision metadata into image files."
    )
    parser.add_argument(
        "--folder",
        type=Path,
        default=None,
        help="Optional folder path. If omitted, a folder picker dialog is shown.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Parallel worker processes for full analysis (default: 1). Higher values use more RAM.",
    )
    parser.add_argument(
        "--high-recall",
        action="store_true",
        help="Enable high-recall object detection (slower).",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files that already contain keywords/categories metadata.",
    )
    parser.add_argument(
        "--checkpoint-file",
        type=Path,
        default=None,
        help="Checkpoint state file path (default: <folder>/.image_describer_cli_checkpoint.json).",
    )
    parser.add_argument(
        "--report-every",
        type=int,
        default=50,
        help="Print progress every N completed files (default: 50).",
    )
    parser.add_argument(
        "--fast",
        dest="fast_mode",
        action="store_true",
        help="Use fast analysis settings for better throughput.",
    )
    parser.add_argument(
        "--no-fast",
        dest="fast_mode",
        action="store_false",
        help="Disable fast analysis settings.",
    )
    parser.add_argument(
        "--resume-checkpoint",
        dest="resume_checkpoint",
        action="store_true",
        help="Resume from checkpoint files if present (default).",
    )
    parser.add_argument(
        "--no-resume-checkpoint",
        dest="resume_checkpoint",
        action="store_false",
        help="Ignore and reset checkpoint files for a fresh run.",
    )
    parser.set_defaults(fast_mode=True, resume_checkpoint=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    folder = args.folder if args.folder else select_folder_via_dialog()

    if folder is None:
        print("No folder selected. Exiting.")
        return 1

    folder = folder.expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        print(f"Folder does not exist: {folder}")
        return 1

    workers = max(1, int(args.workers or 1))
    report_every = max(1, int(args.report_every or 1))
    state_path, done_path = _resolve_cli_checkpoint_paths(folder, args.checkpoint_file)
    if not args.resume_checkpoint:
        state_path.unlink(missing_ok=True)
        done_path.unlink(missing_ok=True)

    image_paths = find_images(folder)
    if not image_paths:
        print(f"No supported images found in {folder}")
        return 1

    done_set: set[str] = set()
    if args.resume_checkpoint:
        done_set = _load_cli_done_paths(done_path)
    previous_state = _load_cli_checkpoint_state(state_path) if args.resume_checkpoint else None
    resume_count = len(done_set)

    print(f"Found {len(image_paths)} image(s) in {folder}")
    print(
        "Options: "
        f"workers={workers}, fast={'ON' if args.fast_mode else 'OFF'}, "
        f"high_recall={'ON' if args.high_recall else 'OFF'}, "
        f"skip_existing={'ON' if args.skip_existing else 'OFF'}, "
        f"resume={'ON' if args.resume_checkpoint else 'OFF'}"
    )
    if resume_count:
        print(f"Resume checkpoint loaded: {resume_count} file(s) already completed.")
    elif previous_state and isinstance(previous_state.get("done_count"), int):
        print(f"Checkpoint state found ({previous_state.get('done_count')} done) but no done-list entries were loaded.")

    pending_paths: list[Path] = []
    skipped_resume = 0
    skipped_existing = 0
    prefilter_start = time.perf_counter()
    done_buffer: list[str] = []

    def flush_done_buffer(force: bool = False) -> None:
        if not args.resume_checkpoint:
            return
        if not done_buffer:
            return
        if (not force) and len(done_buffer) < 64:
            return
        _append_cli_done_paths(done_path, done_buffer)
        done_buffer.clear()

    for image_path in image_paths:
        key = _relative_path_key(image_path, folder)
        if key in done_set:
            skipped_resume += 1
            continue
        if args.skip_existing:
            try:
                existing = read_metadata_from_file(image_path)
            except Exception:
                existing = None
            if _metadata_has_skip_fields(existing):
                skipped_existing += 1
                done_set.add(key)
                if args.resume_checkpoint:
                    done_buffer.append(key)
                    flush_done_buffer()
                continue
        pending_paths.append(image_path)

    flush_done_buffer(force=True)
    prefilter_ms = int(round((time.perf_counter() - prefilter_start) * 1000))
    print(
        f"Pre-scan done in {prefilter_ms}ms | resume-skipped={skipped_resume}, "
        f"existing-skipped={skipped_existing}, pending={len(pending_paths)}"
    )

    updated = 0
    failed = 0
    interrupted = False
    run_start = time.perf_counter()
    last_report_at = run_start
    last_checkpoint_at = run_start
    last_path = ""

    def mark_done(image_path: Path) -> None:
        key = _relative_path_key(image_path, folder)
        done_set.add(key)
        if args.resume_checkpoint:
            done_buffer.append(key)
            flush_done_buffer()

    def completed_total() -> int:
        return skipped_resume + skipped_existing + updated + failed

    def save_checkpoint(force: bool = False) -> None:
        nonlocal last_checkpoint_at
        if not args.resume_checkpoint:
            return
        now = time.perf_counter()
        if not force and (completed_total() % max(10, report_every) != 0) and ((now - last_checkpoint_at) < 8.0):
            return
        flush_done_buffer(force=True)
        elapsed = now - run_start
        payload: dict[str, Any] = {
            "version": 1,
            "folder": str(folder),
            "total_images": len(image_paths),
            "done_count": len(done_set),
            "updated": updated,
            "failed": failed,
            "skipped_resume": skipped_resume,
            "skipped_existing": skipped_existing,
            "pending": max(0, len(image_paths) - completed_total()),
            "last_path": last_path,
            "workers": workers,
            "fast_mode": bool(args.fast_mode),
            "high_recall": bool(args.high_recall),
            "skip_existing": bool(args.skip_existing),
            "status": "interrupted" if interrupted else "running",
            "elapsed_seconds": round(elapsed, 2),
            "updated_at": int(time.time() * 1000),
        }
        _write_cli_checkpoint_state(state_path, payload)
        last_checkpoint_at = now

    def maybe_report(force: bool = False) -> None:
        nonlocal last_report_at
        done_count = completed_total()
        now = time.perf_counter()
        if not force and (done_count % report_every != 0) and ((now - last_report_at) < 12.0):
            return
        elapsed = max(0.001, now - run_start)
        rate = done_count / elapsed
        remaining = max(0, len(image_paths) - done_count)
        eta = (remaining / rate) if rate > 0 else float("inf")
        print(
            f"[{done_count}/{len(image_paths)}] updated={updated} failed={failed} "
            f"skip_existing={skipped_existing} skip_resume={skipped_resume} "
            f"rate={rate:.2f}/s eta={_format_seconds_short(eta)}"
        )
        last_report_at = now

    try:
        if workers == 1:
            print("Loading vision models (single-worker mode; first run may download model weights)...")
            generator = VisionMetadataGenerator()
            try:
                generator.load_models()
            except Exception as exc:
                print(f"Failed to load CV models: {exc}")
                return 1

            for image_path in pending_paths:
                last_path = _relative_path_key(image_path, folder)
                try:
                    metadata = generator.analyze_image(
                        image_path,
                        high_recall=bool(args.high_recall),
                        fast_mode=bool(args.fast_mode),
                    )
                    write_metadata_to_file(image_path, metadata)
                    updated += 1
                    mark_done(image_path)
                except Exception as exc:
                    failed += 1
                    print(f"Error on {last_path}: {exc}")
                maybe_report()
                save_checkpoint()
        else:
            if args.high_recall:
                print("Warning: high-recall + multi-worker can use substantial RAM.")
            print(f"Starting {workers} worker processes...")
            mp_context = _choose_cli_mp_context()
            in_flight_limit = max(workers * 3, workers)
            path_iter = iter(pending_paths)
            in_flight: dict[cf.Future, Path] = {}

            with cf.ProcessPoolExecutor(max_workers=workers, mp_context=mp_context) as executor:
                def submit_next() -> bool:
                    try:
                        next_path = next(path_iter)
                    except StopIteration:
                        return False
                    future = executor.submit(
                        _cli_worker_analyze_and_write,
                        str(next_path),
                        bool(args.high_recall),
                        bool(args.fast_mode),
                    )
                    in_flight[future] = next_path
                    return True

                for _ in range(in_flight_limit):
                    if not submit_next():
                        break

                while in_flight:
                    done_futures, _ = cf.wait(set(in_flight.keys()), return_when=cf.FIRST_COMPLETED)
                    for future in done_futures:
                        image_path = in_flight.pop(future)
                        last_path = _relative_path_key(image_path, folder)
                        try:
                            ok, err = future.result()
                        except Exception as exc:
                            ok, err = False, str(exc)
                        if ok:
                            updated += 1
                            mark_done(image_path)
                        else:
                            failed += 1
                            print(f"Error on {last_path}: {err}")
                        maybe_report()
                        save_checkpoint()
                        submit_next()
    except KeyboardInterrupt:
        interrupted = True
        print("\nInterrupted by user. Saving checkpoint...")
    finally:
        flush_done_buffer(force=True)
        save_checkpoint(force=True)

    maybe_report(force=True)
    elapsed_total = time.perf_counter() - run_start
    if args.resume_checkpoint:
        state_payload: dict[str, Any] = {
            "version": 1,
            "folder": str(folder),
            "total_images": len(image_paths),
            "done_count": len(done_set),
            "updated": updated,
            "failed": failed,
            "skipped_resume": skipped_resume,
            "skipped_existing": skipped_existing,
            "pending": max(0, len(image_paths) - completed_total()),
            "last_path": last_path,
            "workers": workers,
            "fast_mode": bool(args.fast_mode),
            "high_recall": bool(args.high_recall),
            "skip_existing": bool(args.skip_existing),
            "status": "interrupted" if interrupted else "completed",
            "elapsed_seconds": round(elapsed_total, 2),
            "updated_at": int(time.time() * 1000),
        }
        _write_cli_checkpoint_state(state_path, state_payload)

    print("\nDone")
    print(f"Updated:         {updated}")
    print(f"Failed:          {failed}")
    print(f"Skipped existing:{skipped_existing}")
    print(f"Skipped resume:  {skipped_resume}")
    print(f"Elapsed:         {_format_seconds_short(elapsed_total)}")
    if args.resume_checkpoint:
        print(f"Checkpoint:      {state_path}")

    if interrupted:
        return 130
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())

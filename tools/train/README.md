# Training a LoRA on the EmberRealm corpus

The only route to sprites with **new curves and structures** rather than recombinations of the old
ones. Everything up to the training run is done; this is the part that needs a GPU.

---

## What already exists

| step | tool | state |
|---|---|---|
| export the corpus as a training set | `tools/dataset.py` | done — 2,934 images + captions, 320×320, ~18 MB |
| turn model output back into a sprite | `tools/spritify.py` | done — self-test passes |
| judge whether output looks like the game | `tools/stylestats.py` | done — per category |
| the training config | `tools/train/lora_4gb.toml` | here |

---

## The one number that decides your route

**Your card is a GTX 1650 with 4 GB.** That rules out SDXL entirely and makes SD 1.5 tight but
possible at 320px. Two options:

### Cloud — recommended, and it is not close

The dataset is ~18 MB. Upload it, train on a 16 GB T4 (Colab free) or a 24 GB card (RunPod, roughly
$0.30/hr), and the whole run is under an hour with none of the dependency archaeology below.

### Local — viable, but read this first

**Your Python is 3.12 and sd-scripts needs 3.10.** Install 3.10 *alongside* rather than replacing it;
this repo's own tools run on 3.12 and will break if you swap the interpreter out.

```bat
:: 1. Python 3.10, kept separate
winget install -e --id Python.Python.3.10

:: 2. sd-scripts, in its own venv
git clone https://github.com/kohya-ss/sd-scripts
cd sd-scripts
py -3.10 -m venv venv
venv\Scripts\activate
pip install torch==2.1.2 torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
pip install xformers==0.0.23.post1 bitsandbytes-windows
```

---

## Prepare the folder sd-scripts wants

It reads the repeat count out of the directory name, so the images have to sit one level down:

```bat
mkdir _dataset_train\10_emberrealm
xcopy /s _dataset\*.* _dataset_train\10_emberrealm\
```

`10_` means each image is seen ten times per epoch. With ~2,900 images that is a lot — **start with
weapons only**:

```bat
py tools\dataset.py --only weapons
```

84 images, about twenty minutes on a 1650. It proves the whole pipeline end to end and tells you
whether 4 GB actually holds at 320 before you commit hours to the full corpus.

---

## Train

```bat
accelerate launch --num_cpu_threads_per_process 4 train_network.py ^
  --config_file ..\emberrealm-src\tools\train\lora_4gb.toml
```

If it runs out of memory: drop `resolution` to 256, then `network_dim` to 8. If it still will not
fit, that is the card telling you to use the cloud.

---

## Generate, then make them sprites

Prompt with the trigger and the tokens the captions use — including **orientation**, which is a dial
rather than a habit:

```
emberrealm, pixel art sprite, items weapons, sword, upright, flat violet background
emberrealm, pixel art sprite, monsters, six-legged crab, diagonal, flat violet background
```

Then run every generation through the post-processor, because **what a diffusion model emits is not
a sprite** — it is a 320px painting of one, with soft edges, thousands of colours and no alpha:

```bat
py tools\spritify.py out\0001.png --cat "Items · weapons" --size 64 --out assets\items\wpn_new_0.png
```

It keys the violet background by flooding from the frame edge, downscales by *mode* rather than
averaging, snaps to the palette that category actually uses, hardens the alpha, drops isolated
pixels and keeps the largest connected piece — then scores the result against the real art so a bad
generation can be rejected rather than filed.

---

## Honest expectations

- A style LoRA on ~2,900 images learns **this project's look** — palette, contrast, outline weight,
  chunkiness. That part works well and is the main win.
- **New structure is likelier for things there are many of** (characters, monsters, mounts) than for
  weapons, where there are only 84 examples across seven families. If weapons are the goal, expect to
  generate a lot and keep few.
- It will inherit the corpus's habits unless you prompt against them. That is exactly why orientation
  is captioned: the corpus is 962 upright, 242 diagonal, 36 horizontal, so "upright sword" has plenty
  to generalise from even though every sword in `assets/` is diagonal.
- Overtraining shows up as memorisation — it will hand back sprites you already own. `lora_4gb.toml`
  saves every 2 epochs on purpose; compare them rather than assuming the last is best.

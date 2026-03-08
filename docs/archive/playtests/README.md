# Playtests

Organized playtest batches for Terra Miner. Each batch is a numbered folder containing everything a worker needs to execute the tests.

## How It Works

1. **Opus creates a batch** in `active/NNN-description/` with a `MANIFEST.md` and test specifications
2. **Workers execute** by reading `MANIFEST.md` which tells them exactly what to do
3. **Workers write results** to the `results/` subfolder
4. **After completion**, the batch moves to `completed/`

## Running the Next Batch

To find and run the next pending batch:
1. Look in `active/` for the highest-numbered folder
2. Read its `MANIFEST.md`
3. Follow the instructions exactly

## Folder Layout

```
playtests/
  active/          -- batches waiting to be run or in progress
    NNN-name/
      MANIFEST.md  -- worker instructions (ALWAYS read this first)
      *.md         -- test specifications
      results/     -- worker writes reports here
  completed/       -- finished batches (moved from active/ when done)
    NNN-name/
  templates/       -- reusable templates for creating new batches
```

## Numbering

Batches are numbered sequentially: 001, 002, 003...
The highest number in `active/` is always the next batch to run.

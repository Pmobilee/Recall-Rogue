"""
Recall Rogue Gymnasium Environment
===================================
Wraps the Node.js gym server (tests/playtest/headless/gym-server.ts) as a
standard Gymnasium environment for RL training.

The Node.js server runs the real full game code — no reimplementation.
Communication is via newline-delimited JSON on stdin/stdout.
"""

import json
import subprocess
import os
import select
import signal
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from typing import Optional, Any


class RecallRogueEnv(gym.Env):
    """
    Gymnasium environment for Recall Rogue (full game).

    Observation space: Box(120,) float32 in [0, 1]
    Action space: Discrete(30)
    """

    metadata = {"render_modes": []}

    def __init__(
        self,
        correct_rate: float = 0.75,
        ascension_level: int = 0,
        deck_size: int = 15,
        server_path: Optional[str] = None,
        explore_rate: float = 0.0,
    ):
        super().__init__()

        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(120,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(30)

        self.correct_rate = correct_rate
        self.ascension_level = ascension_level
        self.deck_size = deck_size
        self.explore_rate = explore_rate

        # Find the gym server path
        if server_path is None:
            # Resolve relative to this file's location
            this_dir = os.path.dirname(os.path.abspath(__file__))
            repo_root = os.path.abspath(os.path.join(this_dir, '..', '..', '..'))
            self.server_path = os.path.join(repo_root, 'tests', 'playtest', 'headless', 'gym-server.ts')
            self.repo_root = repo_root
        else:
            self.server_path = server_path
            self.repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(server_path))))

        self._process: Optional[subprocess.Popen] = None
        self._last_action_mask = np.ones(30, dtype=bool)  # Track mask from server
        self._start_server()

    def _start_server(self):
        """Spawn the Node.js gym server subprocess."""
        tsconfig = os.path.join(self.repo_root, 'tests', 'playtest', 'headless', 'tsconfig.json')

        # Resolve tsx path directly to avoid npx wrapper (which spawns intermediate
        # processes that don't forward signals, causing hangs on cleanup)
        import shutil
        tsx_bin = shutil.which('tsx')
        if tsx_bin is None:
            # Fallback to npx
            cmd = ['npx', 'tsx', '--tsconfig', tsconfig, self.server_path]
        else:
            cmd = [tsx_bin, '--tsconfig', tsconfig, self.server_path]

        self._process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,  # Capture stderr separately so it doesn't corrupt protocol
            cwd=self.repo_root,
            text=True,
            bufsize=1,  # Line buffered
            # Kill the entire process group on cleanup
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
        )

    def _send(self, msg: dict) -> dict:
        """Send a JSON message to the server and read the response."""
        if self._process is None or self._process.poll() is not None:
            raise RuntimeError("Gym server process is not running")

        line = json.dumps(msg) + '\n'
        self._process.stdin.write(line)
        self._process.stdin.flush()

        # Use select with timeout to prevent hanging if subprocess dies or stalls
        ready, _, _ = select.select([self._process.stdout], [], [], 30.0)
        if not ready:
            raise RuntimeError("Gym server timed out (30s)")

        response_line = self._process.stdout.readline()
        if not response_line:
            stderr = ""
            if self._process.stderr:
                # Non-blocking read of stderr
                if select.select([self._process.stderr], [], [], 0.1)[0]:
                    stderr = self._process.stderr.read(2000)
            raise RuntimeError(f"Gym server returned empty response. stderr: {stderr[:500]}")

        return json.loads(response_line.strip())

    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None) -> tuple:
        """Reset the environment. Returns (observation, info)."""
        super().reset(seed=seed)

        # If process died, restart it
        if self._process is None or self._process.poll() is not None:
            self._start_server()

        opts = {
            "correctRate": self.correct_rate,
            "ascensionLevel": self.ascension_level,
            "deckSize": self.deck_size,
        }
        if options:
            opts.update(options)

        response = self._send({"cmd": "reset", "opts": opts})
        obs = np.array(response["obs"], dtype=np.float32)
        info = response.get("info", {})

        # Store action mask from server
        mask = response.get("actionMask")
        if mask is not None:
            self._last_action_mask = np.array(mask, dtype=bool)
        else:
            self._last_action_mask = np.ones(30, dtype=bool)

        return obs, info

    def step(self, action: int) -> tuple:
        """Take an action. Returns (observation, reward, terminated, truncated, info)."""
        action = int(action)

        # Epsilon-greedy exploration: randomly override with a valid action
        if self.explore_rate > 0 and np.random.random() < self.explore_rate:
            valid_indices = np.where(self._last_action_mask)[0]
            if len(valid_indices) > 0:
                action = int(np.random.choice(valid_indices))

        msg = {"cmd": "step", "action": action}
        response = self._send(msg)
        obs = np.array(response["obs"], dtype=np.float32)
        reward = float(response["reward"])
        done = bool(response["done"])
        truncated = bool(response.get("truncated", False))
        info = response.get("info", {})

        # Store action mask from server
        mask = response.get("actionMask")
        if mask is not None:
            self._last_action_mask = np.array(mask, dtype=bool)
        else:
            self._last_action_mask = np.ones(30, dtype=bool)

        return obs, reward, done, truncated, info

    def action_masks(self) -> np.ndarray:
        """Return boolean mask of valid actions. Used by MaskablePPO from sb3-contrib."""
        return self._last_action_mask

    def close(self):
        """Clean up the subprocess."""
        if self._process is not None:
            try:
                self._send({"cmd": "close"})
            except Exception:
                pass
            try:
                # Kill the entire process group (node + child processes)
                if hasattr(os, 'killpg'):
                    try:
                        os.killpg(os.getpgid(self._process.pid), signal.SIGTERM)
                    except (ProcessLookupError, PermissionError):
                        pass
                else:
                    self._process.terminate()
                self._process.wait(timeout=5)
            except Exception:
                try:
                    if hasattr(os, 'killpg'):
                        os.killpg(os.getpgid(self._process.pid), signal.SIGKILL)
                    else:
                        self._process.kill()
                except Exception:
                    pass
            self._process = None

    def __del__(self):
        self.close()


def make_env(
    correct_rate: float = 0.75,
    ascension_level: int = 0,
    explore_rate: float = 0.0,
    **kwargs,
) -> callable:
    """Factory function for creating RecallRogueEnv instances (for SubprocVecEnv)."""
    def _init():
        return RecallRogueEnv(
            correct_rate=correct_rate,
            ascension_level=ascension_level,
            explore_rate=explore_rate,
            **kwargs,
        )
    return _init

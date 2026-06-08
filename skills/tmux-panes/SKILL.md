---
name: tmux-panes
description: Drive an existing tmux session non-interactively — list sessions/windows/panes, capture pane contents, and send keystrokes (literal text or symbolic keys like C-c, Enter, Up). Use when the user asks to inspect, observe, or send input to a running tmux pane (their own, the dashboard's, or one another agent created); when scripting tmux automation; or when the user mentions `tmux send-keys`, `capture-pane`, `attach`, or attaching to a "pane" / "session" by name. Do NOT use this for spawning brand-new shells from scratch when a plain background process would do — this is for talking to a tmux server that already exists.
---

# Driving tmux panes from a script

The point of this skill is to interact with an **already-running** tmux server — observe what a pane is showing and inject keystrokes — without ever attaching interactively. That's exactly the contract Claude Dashboard's `TmuxService` and `TmuxGateway` rely on (`backend/src/services/tmux.service.ts`), and the same primitives work fine from any shell, script, or Bash tool call.

If you just want a long-running background command, use `nohup` / `setsid` / a process manager. Reach for tmux when you need: a persistent terminal that survives SSH disconnects, a way to *watch* output as a human-readable buffer, or to *type into* a process that's already running (REPL, TUI, prompt for password, etc.).

## The two facts that bite people first

1. **Pick the right socket.** `tmux ls` with no flags hits `$TMUX_TMPDIR/default` for *your* UID. If you're trying to talk to another user's server (or the host's, from inside a container), pass `-S /path/to/socket` on **every** command. Common cases:
   - Host tmux from a rootless container: `-S /tmp/tmux-1001/default` (1001 = host UID; check with `id -u` on the host).
   - System-wide shared socket some setups use: `-S /tmp/tmux-shared`.
   - If you're root in a container and the socket is owned by 1001, you also need to drop UID: `su-exec 1001 tmux -S /tmp/tmux-1001/default ls` — tmux refuses sockets it doesn't own.

2. **`-F` output uses tab as the default separator, but tmux replaces non-printables (including tabs) inside fields with `_`.** That makes parsing fragile. Always pick a separator the format strings can't legitimately contain — `|` is what the dashboard uses, and session names are constrained so they can't include it. Example:
   ```bash
   tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_attached}'
   ```

## Read the world: list and capture

```bash
# Sessions on the default socket
tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}|#{session_activity}|#{session_width}|#{session_height}'

# Every pane in a session, with its target string ready for send-keys / capture-pane
tmux list-panes -s -t SESSION \
  -F '#{window_index}|#{pane_index}|#{window_name}|#{pane_active}|#{window_active}|#{pane_current_command}|#{pane_title}|#{pane_width}|#{pane_height}'
# → target = "<window>.<pane>" (e.g. "0.1"); pass as SESSION:0.1 to other commands.

# Snapshot what a pane shows right now (no scrollback, no escape codes — clean text)
tmux capture-pane -p -t SESSION:0.0

# Same, but keep ANSI/colors so you can re-render or diff
tmux capture-pane -pe -t SESSION:0.0

# Include 200 lines of scrollback above the visible region
tmux capture-pane -pe -S -200 -t SESSION:0.0

# Whole scrollback buffer
tmux capture-pane -pe -S - -t SESSION:0.0
```

`capture-pane -p` prints to stdout (otherwise it copies into a tmux paste buffer, which is rarely what you want from a script). `-e` keeps escape sequences — useful if you'll feed the output to an ANSI-aware renderer; omit it for plain-text logs and grepping.

**`-e` is also how you tell *dim* text from real content.** Plain `-p` collapses colour, so greyed-out **ghost text** — shell autosuggestions, TUI placeholders, Claude Code's proactive prompt suggestions — looks byte-for-byte identical to text the user actually typed. With `-e` the dim run carries an `ESC[2m` (faint) SGR you can grep for: `grep -aqP '\x1b\[(0;)?2m'`. Any decision that turns on "is this real input or just a suggestion?" must capture with `-e`; deciding on `-p` output will misclassify the suggestion as input. The `notify-claude` skill's send-gate depends on exactly this.

To **watch** a pane (poll), capture on a tick and only act when the text changes — that's what the dashboard's gateway does on a 1.5 s interval (`backend/src/websocket/tmux.gateway.ts`). Don't poll faster than ~500 ms; tmux serializes commands through one socket and you'll just queue work.

## Write the world: send-keys

There are two modes, and **mixing them in one call is the most common mistake**:

```bash
# Symbolic keys — tokens are interpreted (C-c, Enter, Up, Down, PageUp, PageDown,
# Tab, Escape, BSpace, Space, F1..F12, M-x, etc.)
tmux send-keys -t SESSION:0.0 C-c
tmux send-keys -t SESSION:0.0 Up Enter        # recall + run last command

# Literal text — every character is typed as-is, no symbolic interpretation
tmux send-keys -t SESSION:0.0 -l 'echo $PATH'

# Type a command AND run it: literal text, THEN a separate send-keys for Enter.
# Do NOT try `send-keys -l 'echo hi' Enter` — with -l, the word "Enter" gets typed.
tmux send-keys -t SESSION:0.0 -l 'echo hi'
tmux send-keys -t SESSION:0.0 Enter
```

The `-l` flag is sticky for the whole call. That's why "type this command and run it" is two calls, not one. Wrap it:

```bash
tmux_run() {
  local target="$1"; shift
  tmux send-keys -t "$target" -l "$*"
  tmux send-keys -t "$target" Enter
}
tmux_run myproj:0.0 'pytest -x tests/test_auth.py'
```

### Targets

`-t` accepts three forms:
- `SESSION` — current window, current pane of that session
- `SESSION:WINDOW` — that window's active pane (window is an index, e.g. `0`, or a name)
- `SESSION:WINDOW.PANE` — exact pane (e.g. `myproj:0.1`)

When in doubt, **always specify the pane** (`SESSION:W.P`). The "active pane" can shift under you if a human is also using the session.

## Idempotent session lifecycle

```bash
# Does it exist? (exit 0 = yes, non-zero = no)
tmux has-session -t SESSION 2>/dev/null

# Create only if missing — detached, with a working dir and an initial command
if ! tmux has-session -t myjob 2>/dev/null; then
  tmux new-session -d -s myjob -c /path/to/repo 'pytest --tb=short -q tests/'
fi

# Rename / kill
tmux rename-session -t old new
tmux kill-session  -t name
```

`new-session -d` is the non-interactive form — it returns immediately instead of attaching. Pair with `capture-pane` later to read the output.

## Validation rules worth copying

Before you pass an externally-supplied name to tmux, gate it. The dashboard uses:

- **Session/window names**: `^[A-Za-z0-9._-]{1,64}$` — letters, digits, dot, dash, underscore. Reject `:` (it's the target separator) and whitespace. (`backend/src/services/tmux.service.ts:318-323`)
- **Targets**: `^[A-Za-z0-9._-]{1,64}(?::\d{1,4}(?:\.\d{1,4})?)?$` (`tmux.service.ts:329-334`)
- **Literal text payloads**: cap at ~16 KB per call; tmux will accept more but the round-trip gets sluggish.
- **Token list for symbolic send-keys**: each token ≤ 512 chars, list non-empty.

This isn't paranoia — `send-keys` will happily inject anything, including shell command substitutions inside the *target* program. Treat it as `eval` for whoever is in that pane.

## Recipe: tail a long-running command and decide when it's done

The "watch a pane until something specific shows up" pattern. Useful for: waiting on a test run that's already started, watching a build inside someone else's tmux, polling a TUI for a status row.

```bash
target="myjob:0.0"
deadline=$(( $(date +%s) + 600 ))   # 10-minute cap
while [ "$(date +%s)" -lt "$deadline" ]; do
  out=$(tmux capture-pane -p -S -200 -t "$target")
  if grep -qE 'PASSED|FAILED|Traceback|exit code [0-9]+' <<<"$out"; then
    echo "$out" | tail -20
    break
  fi
  sleep 2
done
```

Match on **both** success and failure markers — a filter that only sees "PASSED" stays silent through a crash and looks identical to "still running."

## Recipe: scripted password / prompt response

When a process in a pane is blocking on stdin — `sudo`, an SSH `yes/no`, an npm prompt:

```bash
# Watch for the prompt, then answer. Avoid sleep-races by checking the buffer.
target=ops:0.0
for _ in $(seq 1 30); do
  if tmux capture-pane -p -t "$target" | grep -q 'password:'; then
    tmux send-keys -t "$target" -l "$(cat ~/.secrets/db-pw)"
    tmux send-keys -t "$target" Enter
    break
  fi
  sleep 0.5
done
```

Don't echo the secret to the script's own stdout; pass it through a heredoc or file.

## Pitfalls to remember

- **Never run `tmux attach` from an automated context.** It needs a TTY and will either error or hang. `capture-pane` + `send-keys` cover everything attaching gives you, without the TTY.
- **`-F` outputs may include `_` in any field where the source had a non-printable.** Don't trust `pane_title` or `pane_current_command` to be byte-for-byte what was set — tmux sanitises both.
- **`send-keys` is async.** It returns the moment the bytes are queued; the program in the pane hasn't necessarily processed them yet. If your next step depends on the program having reacted, follow with a `capture-pane` poll, not a blind `sleep`.
- **One socket = one mutex.** Concurrent `tmux` calls against the same `-S` are serialized by the server. Heavy-tick polling (sub-500 ms) starves other clients.
- **`kill-session` is irreversible.** There's no "are you sure" — the session, its windows, and any unsaved scrollback are gone. Confirm with `has-session` and consider `capture-pane -S -` first if the buffer matters.
- **Inside a container talking to the host socket**, mount the socket dir read-write (`-v /tmp/tmux-1001:/tmp/tmux-1001`) and either run as the host UID or `su-exec` to it. tmux *will* refuse a socket whose UID it doesn't match.

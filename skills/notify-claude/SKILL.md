---
name: notify-claude
description: Send a message to another Claude Code session running in tmux on the same host — the cross-Claude "team chat" pattern. Use when the user says "tell the X team", "notify the Y agent", "ping the Z session", "let the other Claude know"; references a tmux session name + pane / window number with the implication that another Claude Code instance is running there; or asks to forward a status update / release note / handoff to a peer agent. Wraps the tmux-panes primitive with the conventions for talking *to a Claude*, not to a generic shell — pane identification, capture-before-send to avoid mid-prompt interruptions, queueing via Enter, and waiting for the reply. Do NOT use for sending keystrokes to a non-Claude pane (use tmux-panes directly).
---

# Notifying another Claude Code session via tmux

This is the cross-Claude messaging pattern. Treat it like sending a Slack DM to a colleague whose terminal you share — there's a real agent on the other side that will read what you send as a user message and act on it.

The mechanics are pure `tmux send-keys`; nothing privileged. The dashboard's `TmuxGateway` uses the same primitives. What this skill encodes is **the conventions for talking to a peer Claude, not a raw shell** — how to find them, how not to interrupt them mid-tool-call, how to frame the message, and how to confirm they got it.

## Find the target

Claude Code panes are easy to spot: `pane_current_command` is `claude`, and the pane title is usually whatever task the session is on. List candidates:

```bash
# All Claude sessions across all tmux sessions
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index}|#{window_name}|#{pane_current_command}|#{pane_title}' \
  | awk -F'|' '$3 == "claude"'
```

If the user said "session general, pane #1", they mean **window 1** of session `general` (each Claude usually has one pane per window). The full target is `general:1.0` — always specify `SESSION:W.P`, never just `SESSION`, because the active pane can shift if a human is also driving things.

## Don't interrupt mid-tool-call

Before sending, capture the pane and look at the bottom status line. Claude Code shows one of:

- **Idle**: empty `❯ ` prompt with the working-dir line below. Safe to send — your message lands as the next turn's user input.
- **Mid-tool-call**: `· Perusing… (Xm Ys · …)` or `✶ Pondering… ` or `· Running…` in the status line. Text you send now gets **queued** — Claude Code captures it into the prompt box and shows "Press up to edit queued messages" at the bottom. It fires automatically when the current tool finishes. This is **safe and idiomatic** — queue is the intended interface.
- **Permission prompt**: text like "Do you want to proceed?" with `1.` / `2.` choices visible. **Do NOT send free-form text here** — you'll answer the prompt with the first character of your message, which is almost never what you want. Wait, or send `Escape` first.
- **Pending un-submitted input (real)**: the `❯ ` box has text the human typed but hasn't submitted — rendered at **normal brightness**, cursor at the *end* of the text. **Do NOT send** — your `send-keys -l` appends to whatever's already there, producing `their_pending_textyour_message`. There's no "ours-only" send. Wait until the box clears, or politely abort.
- **Proactive suggestion (ghost text)**: the box *looks* like it already holds a full sentence — e.g. `❯ yes, send it to the nano session` — but that's a greyed-out *suggestion* Claude Code is offering, **not** typed input. The real buffer is empty; the suggestion vanishes the instant any key arrives, so this is **safe to send**. The trap: a plain `capture-pane -p` strips the colour, making a suggestion byte-for-byte identical to real pending input above — so the naive "is the box empty?" check refuses to send and your notification silently never lands. You **must** capture with escape codes (`-pe`) to tell them apart:
  - **Ghost suggestion** → text is **dim** (`ESC[2m`, often `ESC[0;2m`), cursor (`ESC[7m`) sits on its *first* character. Buffer is empty → send.
  - **Real input** → text is **normal brightness** (no `ESC[2m`), cursor at the *end*. Buffer has content → don't send.

  Don't lean on "does the text read like a complete sentence?" to decide — a human can pause mid-prompt on a perfectly complete clause, and a suggestion can be a fragment. The dim/bright render is the deterministic signal; the "is it idle?" timing below is the safety net.

### The gate: idle + dim-aware

One function decides SEND / WAIT / ABORT. It captures **with escape codes** so it can see the dim render, samples the prompt box **twice ~5 s apart** so it never sends into a box that's actively changing, and scopes the idle compare to the *prompt-box text only* (the spinner / "Worked for 1m 39s" / elapsed timers tick every second — comparing the whole pane would always look "changing").

```bash
prompt_gate() {   # echoes: SEND | WAIT | ABORT   — usage: prompt_gate SESSION:W.P
  local t="$1" r1 r2 v1 v2
  # prompt box text, escape codes stripped, ❯ + leading nbsp/space + trailing space removed
  _vis() { sed -E $'s/\x1b\\[[0-9;]*m//g; s/^[^❯]*❯[[:space:]\xc2\xa0]*//; s/[[:space:]]+$//'; }
  # 1. Never answer a permission prompt with prose.
  if tmux capture-pane -p -t "$t" -S -12 | grep -qE 'Do you want to|❯ 1\.'; then
    echo ABORT; return; fi
  # 2. Sample the prompt line twice, 5 s apart (idle check).
  r1=$(tmux capture-pane -pe -t "$t" -S -4 | grep -a '❯' | tail -1); v1=$(printf '%s' "$r1" | _vis)
  sleep 5
  r2=$(tmux capture-pane -pe -t "$t" -S -4 | grep -a '❯' | tail -1); v2=$(printf '%s' "$r2" | _vis)
  # 3. Decide on the *second* (settled) sample.
  [ -z "$v2" ]                                  && { echo SEND; return; }   # empty box
  printf '%s' "$r2" | grep -aqP '\x1b\[(0;)?2m' && { echo SEND; return; }   # dim ghost suggestion → buffer empty
  [ "$v1" != "$v2" ]                            && { echo WAIT; return; }   # bright + changing  → human typing
  echo WAIT                                                                # bright + stable    → real input, paused
}
```

- `SEND` — empty box, or a dim suggestion (buffer is empty either way).
- `WAIT` — real bright text, whether still changing (typing) or settled (paused mid-prompt). Re-poll later; never append.
- `ABORT` — a permission prompt is up; sending prose answers it with your first character. Send `Escape` first, or back off.

`grep -P` guarantees the `\x1b` (ESC) escape matches everywhere; GNU `grep -E` also accepts it. When you `SEND` into a dim-suggestion box, the suggestion is dismissed by your first keystroke — but you can send `Escape` first as belt-and-suspenders if you want a guaranteed-clean buffer.

## Send: literal text, then Enter (separately)

This is the most common mistake. `send-keys -l` is sticky for the whole call — if you pass `Enter` in the same call it gets typed as the literal word "Enter".

```bash
tmux send-keys -t general:1.0 -l "$msg"   # type the message
tmux send-keys -t general:1.0 Enter       # submit it (separate call)
```

If the message contains shell metacharacters (`$`, backticks, `!`), single-quote it or pass it via a heredoc'd `tmux load-buffer` + `paste-buffer`. For plain notification text this is usually a non-issue, but Claude Code messages often include code snippets — be careful with backticks.

## Frame the message like a colleague, not a robot

The other Claude reads your text as a user message. It has no context about you, the project state, or what just shipped. So:

- **Lead with the headline**: "v3.30.1 shipped" or "FK constraint bug filed" — one line, then details.
- **Include the why-care**: what changed, what's unblocked, what the recipient should do (or that nothing is required).
- **Use absolute paths / repo names**, not "here" / "there". The recipient is in a different directory.
- **Sign off** with who you are: `— Claude on <session>:<pane> (Opus 4.7)`. Helps the recipient understand the message wasn't sent by their user.
- **Don't paste long logs.** Link the file or commit SHA. The recipient can read it themselves.

Example shape:

```
v3.30.1 shipped (tag v3.30.1 on origin/main, 2026-05-09). Closes 3 of 4
quirks from your <retest-doc-path>:

- #N: <one-line summary>
- #M: <one-line summary>

Deferred to v3.31.0: <bug>.

cargo install … once crates.io publishes. Re-run your <verification command>
when you can. Smoke-tested locally; all four repros pass.

— Claude on helios:Nano (Opus 4.7)
```

## Confirm delivery, then watch for reply

After sending, capture once to confirm the text landed in the input box (or the queue):

```bash
tmux capture-pane -p -t SESSION:W.P -S -20 | tail -10
# Look for your message text in the ❯ box, or "Press up to edit queued messages"
```

For watching the reply: don't tight-poll. The recipient may be mid-investigation for many minutes. Two acceptable patterns:

1. **Background bash polling**, exit when idle. Use the `Perusing…|Running…|Pondering…|Considering…|Thinking…|Connecting… \(Xm` pattern as the busy marker. When it disappears the agent is idle (either replied or done thinking):
   ```bash
   until ! tmux capture-pane -p -t SESSION:W.P -S -10 \
     | grep -qE '(Perusing…|Running…|Pondering…|Considering…|Thinking…|Connecting…) \([0-9]+[ms]'; do
     sleep 30
   done
   echo "=== peer idle ==="
   tmux capture-pane -p -t SESSION:W.P -S -80 | tail -70
   ```
   Run this with `run_in_background: true` — the harness notifies when it exits.

2. **ScheduleWakeup**, come back in 5–20 min and capture once. Good when you don't need a tight signal and have other work to do.

## Pitfalls specific to Claude-to-Claude

- **The recipient doesn't see your tool calls.** They only see what landed in their `❯` box. Don't reference "the bash command I just ran" — paste the result instead.
- **They might already be working on the same thing.** Capture before send: if their pane title or recent output shows they're already on it, your notification may be redundant or conflicting. Adjust the framing ("FYI you're already on this — confirming v3.30.1 is the right tag") instead of giving instructions.
- **Don't issue commands.** "Run this" or "Do X" reads as authoritative; you have no authority over their session. Offer ("Please re-run … when you can"), don't direct.
- **No threading / no reply-to.** The recipient's response goes to *their* user, not back to you. If you want continuous back-and-forth, you need to keep polling their pane; there's no callback.
- **Claude-B is the production version of this pattern.** It runs a daemon that watches its inbox + plays "press Enter" tricks at scheduled times. For one-off cross-Claude messages, that's overkill — direct `send-keys` is fine. For sustained automation, use Claude-B.

## Recipe: one-shot notify + wait-for-idle

```bash
TARGET="general:1.0"
MSG='<your-message-here, sign with — Claude on …>'

# 1. Sanity-check target
tmux has-session -t "${TARGET%:*}" 2>/dev/null || { echo "no session"; exit 1; }

# 2. Verify recipient is a Claude
[ "$(tmux display-message -p -t "$TARGET" '#{pane_current_command}')" = "claude" ] \
  || { echo "not a Claude pane"; exit 1; }

# 3. Gate: idle + dim-aware (defined above). Only SEND is safe.
case "$(prompt_gate "$TARGET")" in
  WAIT)  echo "box has real pending input — re-poll later, don't append"; exit 1 ;;
  ABORT) echo "permission prompt visible — send Escape or back off"; exit 1 ;;
esac

# 4. Send (literal text, then Enter)
tmux send-keys -t "$TARGET" -l "$MSG"
sleep 0.3
tmux send-keys -t "$TARGET" Enter

# 5. Confirm landed
tmux capture-pane -p -t "$TARGET" -S -15 | tail -8
```

Wrap that in a function if you'll do it more than twice in a session.

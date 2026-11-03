// Pugo: savings goals, milestones and rewards (Phase 4).
// Loaded before script.js. The functions here use the game's shared
// state (state, saveState, peso, sfx...) when they run.

const MILESTONES = [25, 50, 75, 100];

// The first time ANY goal reaches a milestone, these unlock
const MILESTONE_REWARDS = {
  25: [
    { unlock: "hat", text: "Pugo got a salakot hat!" },
    { unlock: "ensaymada", text: "Ensaymada unlocked in the shop" }
  ],
  50: [{ unlock: "turon", text: "Turon unlocked in the shop" }],
  75: [{ unlock: "flowers", text: "A flower patch bloomed in the backyard" }],
  100: [{ unlock: "lechon", text: "Lechon unlocked in the shop" }]
};

function hasUnlock(id) {
  return state.unlocks.includes(id);
}

function findGoal(id) {
  return state.goals.find((goal) => goal.id === id);
}

function goalSaved(goal) {
  return state.entries.reduce((sum, entry) => (entry.goalId === goal.id ? sum + entry.amount : sum), 0);
}

function goalPercent(goal) {
  return Math.min(100, (goalSaved(goal) / goal.target) * 100);
}

// Call after a saving is added to a goal. `before` is the goal's percent
// before the saving. Returns what to show in the reward card, or null.
function checkMilestones(goal, before) {
  const after = goalPercent(goal);
  const reached = MILESTONES.filter((m) => before < m && after >= m && !goal.milestones.includes(m));
  if (reached.length === 0) return null;

  const lines = [];
  reached.forEach((m) => {
    goal.milestones.push(m);
    MILESTONE_REWARDS[m].forEach((reward) => {
      if (!hasUnlock(reward.unlock)) {
        state.unlocks.push(reward.unlock);
        lines.push(reward.text);
      }
    });
    if (m === 100) {
      goal.completedAt = new Date().toISOString();
      state.eggs.push({ id: "e" + Date.now(), goalId: goal.id, goalName: goal.name });
      lines.push("An egg appeared in the nest. Tap it to hatch!");
    }
  });

  return { goal, milestone: reached[reached.length - 1], lines };
}

// ---------- Goals panel ----------

const goalList = document.getElementById("goal-list");
const goalsEmpty = document.getElementById("goals-empty");
const goalSelect = document.getElementById("goal-select");

function nextMilestoneText(goal) {
  const next = MILESTONES.find((m) => !goal.milestones.includes(m));
  if (!next) return "Goal complete!";
  return "Next reward at " + next + "% (" + peso.format((goal.target * next) / 100) + ")";
}

function goalCard(goal) {
  const percent = goalPercent(goal);
  const done = goal.milestones.includes(100);

  const li = document.createElement("li");
  li.className = "goal-card" + (done ? " done" : "");

  const head = document.createElement("div");
  head.className = "goal-head";
  const name = document.createElement("strong");
  name.textContent = goal.name;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "goal-delete";
  remove.textContent = "×";
  remove.setAttribute("aria-label", "Delete goal " + goal.name);
  remove.addEventListener("click", () => deleteGoal(goal));
  head.append(name);
  if (done) {
    const badge = document.createElement("span");
    badge.className = "goal-badge";
    badge.textContent = "Done!";
    head.append(badge);
  }
  head.append(remove);

  const amounts = document.createElement("p");
  amounts.className = "goal-amounts";
  amounts.textContent = peso.format(goalSaved(goal)) + " / " + peso.format(goal.target) + " · " + Math.floor(percent) + "%";

  const bar = document.createElement("div");
  bar.className = "goal-bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", goal.name + " progress");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(Math.floor(percent)));
  const fill = document.createElement("div");
  fill.className = "goal-fill";
  fill.style.width = percent + "%";
  bar.append(fill);
  [25, 50, 75].forEach((m) => {
    const tick = document.createElement("span");
    tick.className = "goal-tick" + (goal.milestones.includes(m) ? " reached" : "");
    tick.style.left = m + "%";
    bar.append(tick);
  });

  const next = document.createElement("p");
  next.className = "goal-next";
  next.textContent = nextMilestoneText(goal);

  li.append(head, amounts, bar, next);
  return li;
}

function renderGoals() {
  goalsEmpty.hidden = state.goals.length > 0;
  goalList.replaceChildren(...state.goals.map(goalCard));
  renderGoalSelect();
}

// The "Which goal?" picker in the Add savings dialog
function renderGoalSelect() {
  const options = [new Option("General savings", "general")];
  state.goals.forEach((goal) => {
    const done = goal.milestones.includes(100);
    options.push(new Option(goal.name + (done ? " (done)" : ""), goal.id));
  });
  goalSelect.replaceChildren(...options);
  goalSelect.value = findGoal(state.lastGoalId) ? state.lastGoalId : "general";
}

function deleteGoal(goal) {
  if (!confirm("Delete \"" + goal.name + "\"? Its savings stay in your total, and rewards you unlocked stay too.")) return;
  // Keep the money: its savings become general savings
  state.entries.forEach((entry) => {
    if (entry.goalId === goal.id) entry.goalId = null;
  });
  state.goals = state.goals.filter((g) => g !== goal);
  if (state.lastGoalId === goal.id) state.lastGoalId = "general";
  saveState();
  renderUI();
  announce("Deleted goal " + goal.name + ".");
}

// ---------- New goal dialog ----------

const goalDialog = document.getElementById("goal-dialog");
const goalForm = document.getElementById("goal-form");
const goalNameInput = document.getElementById("goal-name-input");
const goalTargetInput = document.getElementById("goal-target-input");
const goalError = document.getElementById("goal-error");

function clearGoalError() {
  goalError.textContent = "";
  goalNameInput.removeAttribute("aria-invalid");
  goalTargetInput.removeAttribute("aria-invalid");
}

function goalFail(input, message) {
  goalError.textContent = message;
  input.setAttribute("aria-invalid", "true");
  input.focus();
}

document.getElementById("new-goal-button").addEventListener("click", () => {
  goalForm.reset();
  clearGoalError();
  goalDialog.showModal();
  goalNameInput.focus();
});

document.getElementById("cancel-goal").addEventListener("click", () => goalDialog.close());
goalNameInput.addEventListener("input", clearGoalError);
goalTargetInput.addEventListener("input", clearGoalError);

goalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = goalNameInput.value.trim();
  const target = Math.round(Number(goalTargetInput.value) * 100) / 100;

  if (!name) return goalFail(goalNameInput, "Give your goal a name.");
  if (!goalTargetInput.value.trim() || !Number.isFinite(target) || target <= 0) {
    return goalFail(goalTargetInput, "Enter a target greater than ₱0.");
  }
  if (target > 100000000) return goalFail(goalTargetInput, "That's more than ₱100,000,000. Check the amount.");

  const goal = { id: "g" + Date.now(), name, target, milestones: [], createdAt: new Date().toISOString() };
  state.goals.push(goal);
  state.lastGoalId = goal.id; // next saving goes here by default
  saveState();
  goalDialog.close();
  renderUI();
  sfx.coin();
  announce("New goal: " + name + ", " + peso.format(target) + ".");
});

// ---------- Reward card ----------

const rewardDialog = document.getElementById("reward-dialog");

function showReward(result) {
  const { goal, milestone, lines } = result;
  document.getElementById("reward-title").textContent =
    milestone === 100 ? "Goal complete: " + goal.name + "!" : goal.name + " hit " + milestone + "%!";

  const list = document.getElementById("reward-lines");
  const items = lines.length ? lines : ["Keep going! " + nextMilestoneText(goal) + "."];
  list.replaceChildren(
    ...items.map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    })
  );

  celebrateMilestone();
  rewardDialog.showModal();
}

document.getElementById("close-reward").addEventListener("click", () => rewardDialog.close());

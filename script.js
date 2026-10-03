const STORAGE_KEY = "pugon-goals";

const demoGoals = [
  {
    id: "creative-loaf",
    name: "MacBook Fund",
    recipe: "Creative Loaf",
    target: 60000,
    saved: 12000,
    icon: "🍞"
  },
  {
    id: "safety-pandesal",
    name: "Emergency Fund",
    recipe: "Safety Pandesal",
    target: 20000,
    saved: 4500,
    icon: "🥨"
  },
  {
    id: "roadtrip-croissant",
    name: "Motorcycle Fund",
    recipe: "Roadtrip Croissant",
    target: 90000,
    saved: 0,
    icon: "🥐"
  }
];

const goalGrid = document.querySelector("#goal-grid");
const emptyState = document.querySelector("#empty-state");
const goalTemplate = document.querySelector("#goal-template");
const goalDialog = document.querySelector("#goal-dialog");
const contributionDialog = document.querySelector("#contribution-dialog");
const goalForm = document.querySelector("#goal-form");
const contributionForm = document.querySelector("#contribution-form");

let goals = loadGoals();

function loadGoals() {
  const savedGoals = localStorage.getItem(STORAGE_KEY);

  if (!savedGoals) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoGoals));
    return demoGoals;
  }

  try {
    return JSON.parse(savedGoals);
  } catch {
    return demoGoals;
  }
}

function saveGoals() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

function formatPeso(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(amount);
}

function getProgress(goal) {
  return Math.min((goal.saved / goal.target) * 100, 100);
}

function getStage(progress) {
  if (progress >= 100) {
    return {
      message: "Fresh from the oven. Your dream is ready to serve!",
      milestone: "Goal complete - celebrate this recipe."
    };
  }

  if (progress >= 75) {
    return {
      message: "Almost golden. Your dream is nearly ready.",
      milestone: "One last bake to reach 100%."
    };
  }

  if (progress >= 50) {
    return {
      message: "The dough is rising beautifully.",
      milestone: "You are halfway through this recipe."
    };
  }

  if (progress >= 25) {
    return {
      message: "The ingredients are coming together.",
      milestone: "You reached your first recipe milestone."
    };
  }

  return {
    message: "Your first ingredients are waiting.",
    milestone: "Add a little to begin baking."
  };
}

function renderGoals() {
  goalGrid.innerHTML = "";
  emptyState.hidden = goals.length > 0;

  goals.forEach((goal) => {
    const fragment = goalTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".goal-card");
    const progress = getProgress(goal);
    const stage = getStage(progress);

    card.querySelector(".pastry-icon").textContent = goal.icon;
    card.querySelector(".recipe-name").textContent = goal.recipe;
    card.querySelector(".goal-name").textContent = goal.name;
    card.querySelector(".stage-message").textContent = stage.message;
    card.querySelector(".current-amount").textContent = formatPeso(goal.saved);
    card.querySelector(".target-amount").textContent = `of ${formatPeso(goal.target)}`;
    card.querySelector(".milestone-copy").textContent = stage.milestone;

    const progressTrack = card.querySelector(".progress-track");
    progressTrack.setAttribute("aria-valuenow", Math.round(progress));
    progressTrack.setAttribute("aria-label", `${goal.name}: ${Math.round(progress)} percent saved`);
    card.querySelector(".progress-fill").style.width = `${progress}%`;

    card.querySelector(".add-button").addEventListener("click", () => {
      openContributionDialog(goal);
    });

    card.querySelector(".delete-button").addEventListener("click", () => {
      deleteGoal(goal.id);
    });

    goalGrid.appendChild(fragment);
  });

  updateSummary();
}

function updateSummary() {
  const total = goals.reduce((sum, goal) => sum + goal.saved, 0);
  const nextGoal = goals.find((goal) => getProgress(goal) < 100);

  document.querySelector("#total-saved").textContent = formatPeso(total);
  document.querySelector("#goal-count").textContent = goals.length;
  document.querySelector("#next-milestone").textContent = nextGoal
    ? `${Math.round(getProgress(nextGoal))}% - ${nextGoal.recipe}`
    : "Create a recipe";
}

function openGoalDialog() {
  goalForm.reset();
  goalDialog.showModal();
  document.querySelector("#goal-name").focus();
}

function openContributionDialog(goal) {
  contributionForm.reset();
  document.querySelector("#contribution-goal-id").value = goal.id;
  document.querySelector("#contribution-recipe").textContent = `Add an ingredient to ${goal.recipe}`;
  contributionDialog.showModal();
  document.querySelector("#contribution-amount").focus();
}

function deleteGoal(id) {
  const goal = goals.find((item) => item.id === id);

  if (window.confirm(`Remove ${goal.recipe} from your future menu?`)) {
    goals = goals.filter((item) => item.id !== id);
    saveGoals();
    renderGoals();
  }
}

goalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(goalForm);

  goals.push({
    id: crypto.randomUUID(),
    name: formData.get("name").trim(),
    recipe: formData.get("recipe").trim(),
    target: Number(formData.get("target")),
    saved: 0,
    icon: formData.get("icon")
  });

  saveGoals();
  renderGoals();
  goalDialog.close();
});

contributionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(contributionForm);
  const goal = goals.find((item) => item.id === formData.get("goalId"));

  if (!goal) {
    return;
  }

  goal.saved += Number(formData.get("amount"));
  saveGoals();
  renderGoals();
  contributionDialog.close();
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(`#${button.dataset.close}`).close();
  });
});

document.querySelector("#new-goal-button").addEventListener("click", openGoalDialog);
document.querySelector("#empty-new-goal-button").addEventListener("click", openGoalDialog);

document.querySelector("#reset-button").addEventListener("click", () => {
  if (window.confirm("Reset Pugon to the starter dream recipes?")) {
    goals = structuredClone(demoGoals);
    saveGoals();
    renderGoals();
  }
});

renderGoals();

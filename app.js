const STORAGE_KEY = "sudoku-arcade-progress";

const baseLevels = [
  {
    difficulty: "简单",
    puzzle: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    solution: "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
  },
  {
    difficulty: "普通",
    puzzle: "200080300060070084030500209000105408000000000402706000301007040720040060004010003",
    solution: "245981376169273584837564219976125438513498627482736951391657842728349165654812793",
  },
  {
    difficulty: "进阶",
    puzzle: "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
    solution: "435269781682571493197834562826195347374682915951743628519326874248957136763418259",
  },
];

const elements = {
  board: document.querySelector("#board"),
  keypad: document.querySelector("#keypad"),
  levelBadge: document.querySelector("#level-badge"),
  difficultyBadge: document.querySelector("#difficulty-badge"),
  progressBadge: document.querySelector("#progress-badge"),
  levelSelect: document.querySelector("#level-select"),
  statusText: document.querySelector("#status-text"),
  emptyCount: document.querySelector("#empty-count"),
  mistakeCount: document.querySelector("#mistake-count"),
  prevLevel: document.querySelector("#prev-level"),
  nextLevel: document.querySelector("#next-level"),
  eraseCell: document.querySelector("#erase-cell"),
  hintCell: document.querySelector("#hint-cell"),
  checkBoard: document.querySelector("#check-board"),
  restartLevel: document.querySelector("#restart-level"),
  modal: document.querySelector("#level-modal"),
  modalTitle: document.querySelector("#modal-title"),
  modalCopy: document.querySelector("#modal-copy"),
  stayLevel: document.querySelector("#stay-level"),
  advanceLevel: document.querySelector("#advance-level"),
};

const levels = createLevels();

const state = {
  currentLevel: 0,
  unlockedLevelCount: 1,
  selectedCell: null,
  grid: [],
  solvedLevels: new Set(),
  completionPromptShown: new Set(),
};

init();

function init() {
  loadProgress();
  createKeypad();
  populateLevelSelect();
  bindEvents();
  loadLevel(state.currentLevel, false);
}

function createLevels() {
  const levelsCollection = [];
  for (let index = 0; index < 30; index += 1) {
    const template = baseLevels[Math.floor(index / 10)];
    const variant = transformLevel(template, index + 1);
    levelsCollection.push({
      ...variant,
      id: index + 1,
      title: `第 ${index + 1} 关`,
      difficulty: template.difficulty,
    });
  }
  return levelsCollection;
}

function transformLevel(level, seed) {
  const digitMap = createDigitMap(seed);
  const rowOrder = createAxisOrder(seed * 13 + 7);
  const colOrder = createAxisOrder(seed * 17 + 11);
  const shouldTranspose = seed % 2 === 0;

  const transform = (source) => {
    const grid = stringToGrid(source);
    const reorderedRows = rowOrder.map((row) => grid[row]);
    const reordered = reorderedRows.map((row) => colOrder.map((col) => row[col]));
    const finalGrid = shouldTranspose ? transposeGrid(reordered) : reordered;
    return finalGrid
      .flat()
      .map((value) => (value === "0" ? "0" : String(digitMap[Number(value)])))
      .join("");
  };

  return {
    puzzle: transform(level.puzzle),
    solution: transform(level.solution),
  };
}

function createDigitMap(seed) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pool = [...digits];
  const mapped = [0];
  let currentSeed = seed * 97;

  while (pool.length > 0) {
    currentSeed = (currentSeed * 37 + 17) % 9973;
    const index = currentSeed % pool.length;
    mapped.push(pool.splice(index, 1)[0]);
  }

  return mapped;
}

function createAxisOrder(seed) {
  const bandOrder = shuffle([0, 1, 2], seed * 3 + 5);
  const order = [];

  bandOrder.forEach((band, bandIndex) => {
    const rows = shuffle([0, 1, 2], seed + bandIndex * 19 + 3);
    rows.forEach((row) => order.push(band * 3 + row));
  });

  return order;
}

function shuffle(list, seed) {
  const result = [...list];
  let currentSeed = seed;
  for (let index = result.length - 1; index > 0; index -= 1) {
    currentSeed = (currentSeed * 31 + 9) % 104729;
    const swapIndex = currentSeed % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function stringToGrid(source) {
  return Array.from({ length: 9 }, (_, row) => source.slice(row * 9, row * 9 + 9).split(""));
}

function transposeGrid(grid) {
  return Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => grid[col][row]));
}

function createKeypad() {
  const keypadValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, "清空"];
  keypadValues.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = value;
    button.dataset.value = value === "清空" ? "0" : String(value);
    elements.keypad.append(button);
  });
}

function populateLevelSelect() {
  elements.levelSelect.innerHTML = "";
  levels.forEach((level, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${level.title} · ${level.difficulty}`;
    option.disabled = index >= state.unlockedLevelCount;
    elements.levelSelect.append(option);
  });
}

function bindEvents() {
  elements.keypad.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) {
      return;
    }
    fillSelectedCell(Number(target.dataset.value));
  });

  elements.levelSelect.addEventListener("change", (event) => {
    loadLevel(Number(event.target.value), false);
  });

  elements.prevLevel.addEventListener("click", () => {
    if (state.currentLevel > 0) {
      loadLevel(state.currentLevel - 1, false);
    }
  });

  elements.nextLevel.addEventListener("click", () => {
    const nextLevel = state.currentLevel + 1;
    if (nextLevel < state.unlockedLevelCount) {
      loadLevel(nextLevel, false);
    }
  });

  elements.eraseCell.addEventListener("click", () => fillSelectedCell(0));
  elements.restartLevel.addEventListener("click", () => loadLevel(state.currentLevel, true));
  elements.hintCell.addEventListener("click", revealHint);
  elements.checkBoard.addEventListener("click", inspectBoard);
  elements.stayLevel.addEventListener("click", closeModal);
  elements.advanceLevel.addEventListener("click", advanceToNextLevel);

  window.addEventListener("keydown", (event) => {
    if (elements.modal.classList.contains("hidden") === false) {
      if (event.key === "Escape") {
        closeModal();
      }
      return;
    }

    if (!state.selectedCell) {
      return;
    }

    if (/^[1-9]$/.test(event.key)) {
      fillSelectedCell(Number(event.key));
    }

    if (["Backspace", "Delete", "0"].includes(event.key)) {
      fillSelectedCell(0);
    }
  });
}

function loadLevel(levelIndex, forceReset) {
  if (levelIndex < 0 || levelIndex >= state.unlockedLevelCount) {
    return;
  }

  closeModal();
  state.currentLevel = levelIndex;
  state.selectedCell = null;
  const level = levels[levelIndex];
  if (forceReset) {
    state.completionPromptShown.delete(level.id);
  }
  state.grid = level.puzzle.split("").map((value) => Number(value));

  if (!forceReset && state.solvedLevels.has(level.id)) {
    state.grid = level.solution.split("").map((value) => Number(value));
  }

  renderBoard();
  syncUi();
  saveProgress();
}

function renderBoard() {
  elements.board.innerHTML = "";
  const level = levels[state.currentLevel];

  state.grid.forEach((value, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    const row = Math.floor(index / 9);
    const col = index % 9;
    const isGiven = level.puzzle[index] !== "0";
    const isSelected = state.selectedCell === index;
    const related = state.selectedCell !== null && isRelatedCell(index, state.selectedCell);
    const isIncorrect = value !== 0 && value !== Number(level.solution[index]);

    button.dataset.index = String(index);
    button.textContent = value === 0 ? "" : String(value);

    if (isGiven) {
      button.classList.add("given");
      button.disabled = true;
    } else {
      button.classList.add("editable");
    }

    if (isSelected) {
      button.classList.add("selected");
    } else if (related) {
      button.classList.add("related");
    }

    if (isIncorrect) {
      button.classList.add("incorrect");
    }

    if (col === 2 || col === 5) {
      button.classList.add("border-right");
    }

    if (row === 2 || row === 5) {
      button.classList.add("border-bottom");
    }

    button.addEventListener("click", () => {
      if (isGiven) {
        return;
      }
      state.selectedCell = index;
      renderBoard();
      syncUi();
    });

    elements.board.append(button);
  });
}

function isRelatedCell(firstIndex, secondIndex) {
  const firstRow = Math.floor(firstIndex / 9);
  const firstCol = firstIndex % 9;
  const secondRow = Math.floor(secondIndex / 9);
  const secondCol = secondIndex % 9;
  return (
    firstRow === secondRow ||
    firstCol === secondCol ||
    (Math.floor(firstRow / 3) === Math.floor(secondRow / 3) && Math.floor(firstCol / 3) === Math.floor(secondCol / 3))
  );
}

function fillSelectedCell(value) {
  if (state.selectedCell === null) {
    elements.statusText.textContent = "请先点击一个可填写的空格。";
    return;
  }

  const level = levels[state.currentLevel];
  if (level.puzzle[state.selectedCell] !== "0") {
    return;
  }

  state.grid[state.selectedCell] = value;
  renderBoard();
  syncUi();
  maybeHandleCompletion();
}

function revealHint() {
  const level = levels[state.currentLevel];
  const candidates = state.grid
    .map((value, index) => ({ value, index }))
    .filter(({ value, index }) => value === 0 && level.puzzle[index] === "0");

  if (candidates.length === 0) {
    elements.statusText.textContent = "当前关卡已经没有可提示的空格了。";
    return;
  }

  const hintTarget = candidates[Math.floor(Math.random() * candidates.length)].index;
  state.grid[hintTarget] = Number(level.solution[hintTarget]);
  state.selectedCell = hintTarget;
  renderBoard();
  syncUi();
  maybeHandleCompletion();
}

function inspectBoard() {
  const mistakes = countMistakes();
  if (mistakes === 0) {
    elements.statusText.textContent = hasEmptyCells()
      ? "目前没有错误数字，继续完成剩余空格。"
      : "棋盘完整且无误，本关已完成。";
  } else {
    elements.statusText.textContent = `当前有 ${mistakes} 个错误数字，已用橙红色标出。`;
  }

  maybeHandleCompletion();
}

function maybeHandleCompletion() {
  const level = levels[state.currentLevel];
  const solved = state.grid.join("") === level.solution;
  if (!solved) {
    return;
  }

  state.solvedLevels.add(level.id);
  if (state.unlockedLevelCount < levels.length) {
    state.unlockedLevelCount = Math.max(state.unlockedLevelCount, state.currentLevel + 2);
  }

  populateLevelSelect();
  syncUi();
  saveProgress();

  if (state.completionPromptShown.has(level.id)) {
    return;
  }

  state.completionPromptShown.add(level.id);

  if (state.currentLevel === levels.length - 1) {
    openModal("30 个关卡全部完成", "你已经通关全部数独关卡，可以留在当前棋盘继续查看，或重新选择任意已解锁关卡。", false);
    return;
  }

  openModal(
    `${level.title} 已完成`,
    `你已解开本关。下一关是 ${levels[state.currentLevel + 1].title}，现在要进入吗？`,
    true,
  );
}

function openModal(title, copy, allowAdvance) {
  elements.modalTitle.textContent = title;
  elements.modalCopy.textContent = copy;
  elements.advanceLevel.hidden = !allowAdvance;
  elements.modal.classList.remove("hidden");
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.modal.classList.add("hidden");
  elements.modal.setAttribute("aria-hidden", "true");
}

function advanceToNextLevel() {
  closeModal();
  const nextLevel = Math.min(state.currentLevel + 1, state.unlockedLevelCount - 1);
  loadLevel(nextLevel, false);
}

function countMistakes() {
  const solution = levels[state.currentLevel].solution;
  return state.grid.reduce((count, value, index) => {
    if (value === 0) {
      return count;
    }
    return count + (value !== Number(solution[index]) ? 1 : 0);
  }, 0);
}

function hasEmptyCells() {
  return state.grid.some((value) => value === 0);
}

function syncUi() {
  const level = levels[state.currentLevel];
  const emptyCount = state.grid.filter((value) => value === 0).length;
  const mistakeCount = countMistakes();
  const solved = state.grid.join("") === level.solution;

  elements.levelBadge.textContent = `${level.id} / ${levels.length}`;
  elements.difficultyBadge.textContent = level.difficulty;
  elements.progressBadge.textContent = `已解锁 ${state.unlockedLevelCount} 关`;
  elements.levelSelect.value = String(state.currentLevel);
  elements.emptyCount.textContent = String(emptyCount);
  elements.mistakeCount.textContent = String(mistakeCount);
  elements.prevLevel.disabled = state.currentLevel === 0;
  elements.nextLevel.disabled = state.currentLevel + 1 >= state.unlockedLevelCount;

  if (solved) {
    elements.statusText.textContent = "本关已完成，可选择停留当前关卡，或通过弹窗进入下一关。";
  } else if (state.selectedCell !== null) {
    const row = Math.floor(state.selectedCell / 9) + 1;
    const col = (state.selectedCell % 9) + 1;
    elements.statusText.textContent = `当前选中第 ${row} 行第 ${col} 列。`;
  } else {
    elements.statusText.textContent = "请选择空白格，使用数字键盘或键盘输入 1-9。";
  }
}

function loadProgress() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    state.unlockedLevelCount = Math.min(Math.max(stored.unlockedLevelCount || 1, 1), levels.length);
    state.currentLevel = Math.min(stored.currentLevel || 0, state.unlockedLevelCount - 1);
    state.solvedLevels = new Set(Array.isArray(stored.solvedLevels) ? stored.solvedLevels : []);
  } catch {
    state.unlockedLevelCount = 1;
    state.currentLevel = 0;
    state.solvedLevels = new Set();
  }
}

function saveProgress() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      unlockedLevelCount: state.unlockedLevelCount,
      currentLevel: state.currentLevel,
      solvedLevels: [...state.solvedLevels],
    }),
  );
}
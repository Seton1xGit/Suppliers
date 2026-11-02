const steps = [
  {
    target: () => document.getElementById("search-form"),
    title: "Найди товар или поставщика",
    text: "Введи товар, материал или название компании. Например, стакан или крахмал. Результаты обновятся сразу.",
  },
  {
    target: () => document.getElementById("region"),
    title: "Укажи город доставки",
    text: "Выбери город или регион получения и нужное направление. Здесь учитывается подтвержденная доставка. Город компании указан отдельно.",
  },
  {
    target: () =>
      document.querySelector("#cards .compare-button") ||
      document.querySelector(".header [data-open-compare]"),
    title: "Сравни условия поставщиков",
    text: 'Добавь от 2 до 4 компаний кнопками "Сравнить", затем открой общую таблицу через "Сравнить" в шапке сайта. Контакты и заметки доступны в карточке компании.',
  },
  {
    target: () => document.querySelector("#design-picker summary"),
    title: "Попробуй другое оформление",
    text: 'Здесь доступны 7 оформлений. Поиск, фильтры, сравнение и заметки сохранятся при переключении. Повторить эти подсказки можно через "Как пользоваться".',
  },
];
export function createTour({ store, persist }) {
  const dialog = document.createElement("dialog");
  dialog.id = "tour-dialog";
  dialog.className = "tour-dialog";
  dialog.setAttribute("aria-labelledby", "tour-title");
  dialog.setAttribute("aria-describedby", "tour-description");
  dialog.innerHTML =
    '<div class="tour-spotlight" aria-hidden="true"></div><section class="tour-card"><div class="tour-header"><span id="tour-progress" aria-live="polite"></span><div><button id="tour-skip" type="button">Пропустить</button><button id="tour-close" type="button" aria-label="Закрыть подсказки">×</button></div></div><h2 id="tour-title"></h2><p id="tour-description"></p><div class="tour-actions"><button id="tour-back" type="button">Назад</button><button id="tour-next" type="button" autofocus>Далее</button></div></section>';
  document.body.append(dialog);
  const card = dialog.querySelector(".tour-card"),
    spot = dialog.querySelector(".tour-spotlight"),
    next = dialog.querySelector("#tour-next"),
    back = dialog.querySelector("#tour-back");
  let index = 0,
    returnFocus = null,
    frame;
  function position() {
    if (!dialog.open) return;
    const target =
      steps[index].target() || document.getElementById("result-count");
    const rect = target.getBoundingClientRect(),
      pad = 6,
      w = innerWidth,
      h = innerHeight;
    const x = Math.max(7, rect.left - pad),
      y = Math.max(7, rect.top - pad),
      right = Math.min(w - 7, rect.right + pad),
      bottom = Math.min(h - 7, rect.bottom + pad);
    Object.assign(spot.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${Math.max(0, right - x)}px`,
      height: `${Math.max(0, bottom - y)}px`,
    });
    const size = card.getBoundingClientRect(),
      left = Math.max(
        14,
        Math.min(
          w - size.width - 14,
          rect.left + rect.width / 2 - size.width / 2,
        ),
      );
    let top = bottom + 16;
    if (top + size.height > h - 14) top = y - size.height - 16;
    if (top < 14) top = Math.max(14, h - size.height - 14);
    Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  }
  function schedulePosition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  }
  function showStep() {
    const step = steps[index];
    dialog.dataset.step = String(index + 1);
    dialog.querySelector("#tour-progress").textContent =
      `Шаг ${index + 1} из ${steps.length}`;
    dialog.querySelector("#tour-title").textContent = step.title;
    dialog.querySelector("#tour-description").textContent = step.text;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? "Начать работу" : "Далее";
    const target = step.target() || document.getElementById("result-count");
    const rect = target.getBoundingClientRect();
    if (
      rect.top < 12 ||
      rect.bottom > innerHeight - 12 ||
      rect.left < 0 ||
      rect.right > innerWidth
    )
      target.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "instant",
      });
    position();
    next.focus({ preventScroll: true });
  }
  function finish() {
    if (!dialog.open) return;
    store.state.tourSeen = true;
    persist();
    dialog.close();
    cancelAnimationFrame(frame);
    const target =
      returnFocus?.isConnected && returnFocus !== document.body
        ? returnFocus
        : document.getElementById("query");
    target?.focus({ preventScroll: true });
  }
  function start() {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    index = 0;
    document.getElementById("design-picker").open = false;
    dialog.showModal();
    showStep();
  }
  next.addEventListener("click", () => {
    if (index === steps.length - 1) finish();
    else {
      index++;
      showStep();
    }
  });
  back.addEventListener("click", () => {
    if (index > 0) {
      index--;
      showStep();
    }
  });
  dialog.querySelector("#tour-skip").addEventListener("click", finish);
  dialog.querySelector("#tour-close").addEventListener("click", finish);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish();
  });
  window.addEventListener("resize", schedulePosition);
  window.addEventListener("scroll", schedulePosition, true);
  document.getElementById("tour-help").addEventListener("click", start);
  return {
    start,
    async startIfNeeded() {
      await document.fonts.ready;
      if (!store.state.tourSeen) start();
      document.body.dataset.tourReady = "true";
    },
  };
}

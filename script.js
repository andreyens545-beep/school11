/**
 * МБОУ СОШ №11 — спортивно-образовательный портал
 * Модальные окна, localStorage, валидация, счётчики, админ-панель, контакты
 */
(function () {
  "use strict";

  /* ===================================================================
   * 1. КОНСТАНТЫ И УТИЛИТЫ
   * =================================================================== */

  /** Ключи localStorage для заявок */
  var STORAGE_KEYS = {
    sections: "school11_section_applications",
    teachers: "school11_teacher_applications",
  };

  /** Целевая дата: День открытых дверей — 1 сентября 2026, 10:00 */
  var OPEN_DOORS_DATE = new Date(2026, 8, 1, 10, 0, 0);

  /** Подписи направлений (форма контактов) */
  var SUBJECT_LABELS = {
    math: "Математика",
    russian: "Русский язык",
    informatics: "Информатика",
    history: "История",
    biology: "Биология",
    english: "Английский язык",
    physics: "Физика",
    chemistry: "Химия",
  };

  /** Подписи типов занятий (форма контактов) */
  var LESSON_TYPE_LABELS = {
    ege: "ЕГЭ",
    oge: "ОГЭ",
    repetitor: "Репетиторство",
    olympiad: "Олимпиады",
  };

  /** Подписи типов занятий (модалка педагога) */
  var TEACHER_LESSON_LABELS = {
    consultation: "Консультация",
    extra: "Дополнительное занятие",
    competition: "Подготовка к соревнованиям",
    sport: "Спортивная подготовка",
  };

  /** Подписи удобного времени (модалка секции) */
  var PREFERRED_TIME_LABELS = {
    "weekday-morning": "Будни, до 14:00",
    "weekday-afternoon": "Будни, после 14:00",
    saturday: "Суббота",
    flex: "Согласовать с тренером",
  };

  var openDoorsAlertShown = false;
  var currentAdminFilter = "all";

  /**
   * Безопасное чтение JSON из localStorage
   * @param {string} key — ключ хранилища
   * @returns {Array}
   */
  function loadFromStorage(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Ошибка чтения localStorage:", e);
      return [];
    }
  }

  /**
   * Сохранение массива в localStorage
   * @param {string} key — ключ хранилища
   * @param {Array} data — данные для записи
   */
  function saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("Ошибка записи localStorage:", e);
    }
  }

  /**
   * Проверка непустой строки
   * @param {string} val
   * @returns {boolean}
   */
  function isNotEmpty(val) {
    return typeof val === "string" && val.trim() !== "";
  }

  /**
   * Валидация телефона: минимум 10 цифр
   * @param {string} phone
   * @returns {boolean}
   */
  function isValidPhone(phone) {
    var digits = phone.replace(/\D/g, "");
    return digits.length >= 10;
  }

  /**
   * Валидация email
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /**
   * Показать ошибку поля формы
   * @param {string} fieldId — id поля или имя группы
   * @param {string} message — текст ошибки
   */
  function showFieldError(fieldId, message) {
    var el = document.querySelector('[data-error-for="' + fieldId + '"]');
    if (el) {
      el.textContent = message || "";
    }
  }

  /**
   * Очистить все ошибки внутри формы
   * @param {HTMLFormElement} form
   */
  function clearFormErrors(form) {
    if (!form) return;
    var errors = form.querySelectorAll(".form-error");
    for (var i = 0; i < errors.length; i++) {
      errors[i].textContent = "";
    }
  }

  /**
   * Показать toast-уведомление
   * @param {string} message — текст
   * @param {boolean} isSuccess — зелёный стиль
   */
  function showToast(message, isSuccess) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast toast--visible" + (isSuccess ? " toast--success" : "");
    setTimeout(function () {
      toast.classList.remove("toast--visible");
    }, 3500);
  }

  /**
   * Форматирование даты для таблицы администратора
   * @param {string} iso — ISO-строка
   * @returns {string}
   */
  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  /* ===================================================================
   * 2. МОДУЛЬ ModalManager — открытие/закрытие модальных окон
   * =================================================================== */

  /**
   * Открыть модальное окно
   * @param {HTMLElement} modal — элемент .modal
   */
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("modal--open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  /**
   * Закрыть модальное окно
   * @param {HTMLElement} modal — элемент .modal
   */
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("modal--open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /**
   * Инициализация обработчиков закрытия для модального окна
   * @param {HTMLElement} modal
   */
  function initModalCloseHandlers(modal) {
    if (!modal) return;

    var closeBtns = modal.querySelectorAll("[data-modal-close]");
    for (var i = 0; i < closeBtns.length; i++) {
      closeBtns[i].addEventListener("click", function () {
        closeModal(modal);
      });
    }

    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal(modal);
      }
    });
  }

  /* ===================================================================
   * 3. МОДУЛЬ SectionRegistration — запись на спортивную секцию
   * =================================================================== */

  /**
   * Открыть модалку записи на секцию с подстановкой названия
   * @param {string} sectionName — название секции
   */
  function openSectionModal(sectionName) {
    var modal = document.getElementById("sectionModal");
    var sectionInput = document.getElementById("sectionName");
    var form = document.getElementById("sectionForm");

    if (sectionInput) {
      sectionInput.value = sectionName || "";
    }
    if (form) {
      clearFormErrors(form);
      var msg = document.getElementById("sectionFormMessage");
      if (msg) msg.textContent = "";
    }
    openModal(modal);
  }

  /**
   * Валидация формы записи на секцию
   * @param {HTMLFormElement} form
   * @returns {boolean}
   */
  function validateSectionForm(form) {
    clearFormErrors(form);
    var valid = true;

    var name = document.getElementById("sectionStudentName");
    var cls = document.getElementById("sectionStudentClass");
    var age = document.getElementById("sectionStudentAge");
    var parent = document.getElementById("sectionParentName");
    var phone = document.getElementById("sectionPhone");
    var email = document.getElementById("sectionEmail");
    var section = document.getElementById("sectionName");
    var time = document.getElementById("sectionPreferredTime");

    if (!name || !isNotEmpty(name.value)) {
      showFieldError("sectionStudentName", "Введите ФИО ученика");
      valid = false;
    }
    if (!cls || !isNotEmpty(cls.value)) {
      showFieldError("sectionStudentClass", "Укажите класс");
      valid = false;
    }
    if (!age || !age.value || Number(age.value) < 6 || Number(age.value) > 18) {
      showFieldError("sectionStudentAge", "Укажите возраст от 6 до 18");
      valid = false;
    }
    if (!parent || !isNotEmpty(parent.value)) {
      showFieldError("sectionParentName", "Введите ФИО родителя");
      valid = false;
    }
    if (!phone || !isValidPhone(phone.value)) {
      showFieldError("sectionPhone", "Введите корректный телефон (мин. 10 цифр)");
      valid = false;
    }
    if (!email || !isValidEmail(email.value)) {
      showFieldError("sectionEmail", "Введите корректный email");
      valid = false;
    }
    if (!section || !isNotEmpty(section.value)) {
      showFieldError("sectionName", "Секция не выбрана");
      valid = false;
    }
    if (!time || !time.value) {
      showFieldError("sectionPreferredTime", "Выберите удобное время");
      valid = false;
    }

    return valid;
  }

  /**
   * Отправка заявки на спортивную секцию
   * @param {Event} event
   */
  function submitSectionForm(event) {
    event.preventDefault();
    var form = document.getElementById("sectionForm");
    if (!form || !validateSectionForm(form)) return;

    var timeSelect = document.getElementById("sectionPreferredTime");
    var timeValue = timeSelect ? timeSelect.value : "";
    var timeLabel = PREFERRED_TIME_LABELS[timeValue] || timeValue;

    var application = {
      id: Date.now(),
      type: "section",
      studentName: document.getElementById("sectionStudentName").value.trim(),
      studentClass: document.getElementById("sectionStudentClass").value.trim(),
      studentAge: document.getElementById("sectionStudentAge").value,
      parentName: document.getElementById("sectionParentName").value.trim(),
      phone: document.getElementById("sectionPhone").value.trim(),
      email: document.getElementById("sectionEmail").value.trim(),
      section: document.getElementById("sectionName").value.trim(),
      preferredTime: timeLabel,
      comment: document.getElementById("sectionComment").value.trim(),
      direction: document.getElementById("sectionName").value.trim(),
      createdAt: new Date().toISOString(),
    };

    var list = loadFromStorage(STORAGE_KEYS.sections);
    list.push(application);
    saveToStorage(STORAGE_KEYS.sections, list);

    var msg = document.getElementById("sectionFormMessage");
    if (msg) {
      msg.textContent = "Заявка успешно отправлена! Ожидайте звонка для подтверждения.";
      msg.className = "modal-form__message modal-form__message--success";
    }

    showToast("Вы успешно записаны в секцию «" + application.section + "»!", true);
    form.reset();

    setTimeout(function () {
      closeModal(document.getElementById("sectionModal"));
      if (msg) {
        msg.textContent = "";
        msg.className = "modal-form__message";
      }
    }, 1500);
  }

  /**
   * Инициализация модуля записи на секции
   */
  function initSectionRegistration() {
    var buttons = document.querySelectorAll(".section-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        openSectionModal(this.getAttribute("data-section") || "");
      });
    }

    var modal = document.getElementById("sectionModal");
    initModalCloseHandlers(modal);

    var form = document.getElementById("sectionForm");
    if (form) {
      form.addEventListener("submit", submitSectionForm);
    }

    var phoneField = document.getElementById("sectionPhone");
    if (phoneField) {
      phoneField.addEventListener("input", onPhoneInput);
    }
  }

  /* ===================================================================
   * 4. МОДУЛЬ TeacherConsultation — запись к педагогу
   * =================================================================== */

  /**
   * Открыть модалку консультации с подстановкой педагога
   * @param {string} teacherName — ФИО педагога
   * @param {string} subject — предмет
   */
  function openTeacherModal(teacherName, subject) {
    var modal = document.getElementById("teacherModal");
    var teacherInput = document.getElementById("teacherName");
    var subjectInput = document.getElementById("teacherSubject");
    var form = document.getElementById("teacherForm");

    if (teacherInput) teacherInput.value = teacherName || "";
    if (subjectInput) subjectInput.value = subject || "";
    if (form) {
      clearFormErrors(form);
      var msg = document.getElementById("teacherFormMessage");
      if (msg) msg.textContent = "";
    }
    openModal(modal);
  }

  /**
   * Валидация формы консультации к педагогу
   * @param {HTMLFormElement} form
   * @returns {boolean}
   */
  function validateTeacherForm(form) {
    clearFormErrors(form);
    var valid = true;

    var name = document.getElementById("teacherStudentName");
    var cls = document.getElementById("teacherStudentClass");
    var phone = document.getElementById("teacherPhone");
    var lessonType = form.querySelector('input[name="lessonType"]:checked');
    var date = document.getElementById("teacherDate");
    var time = document.getElementById("teacherTime");

    if (!name || !isNotEmpty(name.value)) {
      showFieldError("teacherStudentName", "Введите ФИО ученика");
      valid = false;
    }
    if (!cls || !isNotEmpty(cls.value)) {
      showFieldError("teacherStudentClass", "Укажите класс");
      valid = false;
    }
    if (!phone || !isValidPhone(phone.value)) {
      showFieldError("teacherPhone", "Введите корректный телефон");
      valid = false;
    }
    if (!lessonType) {
      showFieldError("lessonType", "Выберите тип занятия");
      valid = false;
    }
    if (!date || !date.value) {
      showFieldError("teacherDate", "Укажите желаемую дату");
      valid = false;
    }
    if (!time || !time.value) {
      showFieldError("teacherTime", "Укажите желаемое время");
      valid = false;
    }

    return valid;
  }

  /**
   * Отправка заявки на консультацию к педагогу
   * @param {Event} event
   */
  function submitTeacherForm(event) {
    event.preventDefault();
    var form = document.getElementById("teacherForm");
    if (!form || !validateTeacherForm(form)) return;

    var lessonRadio = form.querySelector('input[name="lessonType"]:checked');
    var lessonValue = lessonRadio ? lessonRadio.value : "";
    var lessonLabel = TEACHER_LESSON_LABELS[lessonValue] || lessonValue;
    var teacherName = document.getElementById("teacherName").value.trim();
    var subject = document.getElementById("teacherSubject").value.trim();

    var application = {
      id: Date.now(),
      type: "teacher",
      studentName: document.getElementById("teacherStudentName").value.trim(),
      studentClass: document.getElementById("teacherStudentClass").value.trim(),
      phone: document.getElementById("teacherPhone").value.trim(),
      teacher: teacherName,
      subject: subject,
      lessonType: lessonLabel,
      preferredDate: document.getElementById("teacherDate").value,
      preferredTime: document.getElementById("teacherTime").value,
      comment: document.getElementById("teacherComment").value.trim(),
      direction: teacherName + " — " + subject,
      createdAt: new Date().toISOString(),
    };

    var list = loadFromStorage(STORAGE_KEYS.teachers);
    list.push(application);
    saveToStorage(STORAGE_KEYS.teachers, list);

    var msg = document.getElementById("teacherFormMessage");
    if (msg) {
      msg.textContent = "Заявка успешно отправлена! Ожидайте звонка для подтверждения.";
      msg.className = "modal-form__message modal-form__message--success";
    }

    showToast("Вы записаны на консультацию к " + teacherName + "!", true);
    form.reset();

    setTimeout(function () {
      closeModal(document.getElementById("teacherModal"));
      if (msg) {
        msg.textContent = "";
        msg.className = "modal-form__message";
      }
    }, 1500);
  }

  /**
   * Инициализация модуля консультаций к педагогам
   */
  function initTeacherConsultation() {
    var buttons = document.querySelectorAll(".teacher-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        openTeacherModal(
          this.getAttribute("data-teacher") || "",
          this.getAttribute("data-subject") || ""
        );
      });
    }

    var modal = document.getElementById("teacherModal");
    initModalCloseHandlers(modal);

    var form = document.getElementById("teacherForm");
    if (form) {
      form.addEventListener("submit", submitTeacherForm);
    }

    var phoneField = document.getElementById("teacherPhone");
    if (phoneField) {
      phoneField.addEventListener("input", onPhoneInput);
    }
  }

  /* ===================================================================
   * 5. МОДУЛЬ CounterAnimation — анимация счётчиков на главной
   * =================================================================== */

  /**
   * Плавный count-up от 0 до target
   * @param {HTMLElement} el — элемент .stats-card__value
   * @param {number} target — конечное значение
   * @param {number} duration — длительность в мс
   */
  function animateCounter(el, target, duration) {
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(start + (target - start) * eased);
      el.textContent = String(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = String(target);
      }
    }

    requestAnimationFrame(step);
  }

  /**
   * Инициализация анимации счётчиков при появлении блока
   */
  function initCounterAnimation() {
    var section = document.getElementById("homeStats");
    if (!section) return;

    var cards = section.querySelectorAll(".stats-card[data-count]");
    if (!cards.length) return;

    var animated = false;

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !animated) {
              animated = true;
              for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                var valueEl = card.querySelector(".stats-card__value");
                var target = parseInt(card.getAttribute("data-count"), 10) || 0;
                if (valueEl) {
                  animateCounter(valueEl, target, 1500);
                }
              }
              observer.disconnect();
            }
          });
        },
        { threshold: 0.3 }
      );
      observer.observe(section);
    } else {
      for (var j = 0; j < cards.length; j++) {
        var valEl = cards[j].querySelector(".stats-card__value");
        var tgt = parseInt(cards[j].getAttribute("data-count"), 10) || 0;
        if (valEl) valEl.textContent = String(tgt);
      }
    }
  }

  /* ===================================================================
   * 6. МОДУЛЬ AdminPanel — управление заявками
   * =================================================================== */

  /**
   * Получить все заявки из обоих хранилищ
   * @returns {Array}
   */
  function getAllApplications() {
    var sections = loadFromStorage(STORAGE_KEYS.sections);
    var teachers = loadFromStorage(STORAGE_KEYS.teachers);
    var all = sections.concat(teachers);
    all.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return all;
  }

  /**
   * Удалить заявку по id и типу
   * @param {number} id
   * @param {string} type — 'section' | 'teacher'
   */
  function deleteApplication(id, type) {
    var key = type === "section" ? STORAGE_KEYS.sections : STORAGE_KEYS.teachers;
    var list = loadFromStorage(key);
    var filtered = list.filter(function (item) {
      return item.id !== id;
    });
    saveToStorage(key, filtered);
    renderAdminTable();
    showToast("Заявка удалена", true);
  }

  /**
   * Очистить все заявки
   */
  function clearAllApplications() {
    if (!window.confirm("Удалить все заявки? Это действие нельзя отменить.")) return;
    saveToStorage(STORAGE_KEYS.sections, []);
    saveToStorage(STORAGE_KEYS.teachers, []);
    renderAdminTable();
    showToast("Все заявки удалены", true);
  }

  /**
   * Подпись типа заявки для таблицы
   * @param {string} type
   * @returns {string}
   */
  function getTypeLabel(type) {
    return type === "section" ? "Секция" : "Педагог";
  }

  /**
   * Отрисовка таблицы заявок с учётом фильтра
   */
  function renderAdminTable() {
    var tbody = document.getElementById("applicationsTableBody");
    var table = document.getElementById("applicationsTable");
    var empty = document.getElementById("adminEmpty");
    if (!tbody) return;

    var all = getAllApplications();
    var filtered = all.filter(function (item) {
      if (currentAdminFilter === "all") return true;
      return item.type === currentAdminFilter;
    });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      if (table) table.classList.add("admin-table--hidden");
      if (empty) empty.classList.add("admin-empty--visible");
      return;
    }

    if (table) table.classList.remove("admin-table--hidden");
    if (empty) empty.classList.remove("admin-empty--visible");

    for (var i = 0; i < filtered.length; i++) {
      var app = filtered[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + (i + 1) + "</td>" +
        "<td>" + getTypeLabel(app.type) + "</td>" +
        "<td>" + (app.studentName || "—") + "</td>" +
        "<td>" + (app.phone || "—") + "</td>" +
        "<td>" + (app.direction || "—") + "</td>" +
        "<td>" + formatDate(app.createdAt) + "</td>" +
        '<td><button type="button" class="admin-btn-delete" data-id="' + app.id + '" data-type="' + app.type + '">Удалить</button></td>';
      tbody.appendChild(tr);
    }

    var deleteBtns = tbody.querySelectorAll(".admin-btn-delete");
    for (var j = 0; j < deleteBtns.length; j++) {
      deleteBtns[j].addEventListener("click", function () {
        var appId = parseInt(this.getAttribute("data-id"), 10);
        var appType = this.getAttribute("data-type");
        deleteApplication(appId, appType);
      });
    }
  }

  /**
   * Инициализация админ-панели
   */
  function initAdminPanel() {
    var tbody = document.getElementById("applicationsTableBody");
    if (!tbody) return;

    var filters = document.querySelectorAll(".admin-filter");
    for (var i = 0; i < filters.length; i++) {
      filters[i].addEventListener("click", function () {
        currentAdminFilter = this.getAttribute("data-filter") || "all";
        for (var j = 0; j < filters.length; j++) {
          filters[j].classList.remove("admin-filter--active");
        }
        this.classList.add("admin-filter--active");
        renderAdminTable();
      });
    }

    var clearBtn = document.getElementById("clearAllApplications");
    if (clearBtn) {
      clearBtn.addEventListener("click", clearAllApplications);
    }

    renderAdminTable();
  }

  /* ===================================================================
   * 7. МОДУЛЬ Contacts — форма контактов, таймер (contacts.html)
   * =================================================================== */

  function pluralDirections(n) {
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return "направлений";
    if (mod10 === 1) return "направление";
    if (mod10 >= 2 && mod10 <= 4) return "направления";
    return "направлений";
  }

  function submitForm(event) {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    var form = document.getElementById("registrationForm");
    if (!form) return;

    var nameInput = document.getElementById("studentName");
    var classInput = document.getElementById("studentClass");
    var phoneInput = document.getElementById("studentPhone");

    var name = nameInput ? nameInput.value.trim() : "";
    var classVal = classInput ? classInput.value.trim() : "";
    var phone = phoneInput ? phoneInput.value.trim() : "";

    if (name === "") {
      window.alert("Пожалуйста, введите ваше ФИО");
      return;
    }

    var selectedSubjects = [];
    var checkboxes = form.querySelectorAll('input[type="checkbox"][name="subject"]');
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) {
        selectedSubjects.push(SUBJECT_LABELS[checkboxes[i].id] || checkboxes[i].value);
      }
    }

    var lessonType = "не указан";
    var lessonRadio = form.querySelector('input[name="lessonType"]:checked');
    if (lessonRadio) {
      lessonType = LESSON_TYPE_LABELS[lessonRadio.value] || lessonRadio.value;
    }

    var timeText = "не указано";
    var timeSelect = document.getElementById("preferredTime");
    if (timeSelect && timeSelect.selectedIndex > 0) {
      timeText = timeSelect.options[timeSelect.selectedIndex].text;
    }

    var subjectsListStr = selectedSubjects.length > 0 ? selectedSubjects.join(", ") : "не выбрано";

    var msg =
      "Уважаемый(ая) " + name + "! Вы записаны на " +
      selectedSubjects.length + " " + pluralDirections(selectedSubjects.length) +
      ": " + subjectsListStr + ". Тип занятий: " + lessonType +
      ". Ожидайте звонка для подтверждения.";

    window.alert(msg);
  }

  function clearForm() {
    var form = document.getElementById("registrationForm");
    var msg = document.getElementById("formMessage");
    if (!form) return;

    var textInputs = form.querySelectorAll('input[type="text"], input[type="tel"]');
    for (var i = 0; i < textInputs.length; i++) textInputs[i].value = "";

    var allCheckboxes = form.querySelectorAll('input[type="checkbox"]');
    for (var c = 0; c < allCheckboxes.length; c++) allCheckboxes[c].checked = false;

    var allRadios = form.querySelectorAll('input[type="radio"]');
    for (var r = 0; r < allRadios.length; r++) allRadios[r].checked = false;

    var select = document.getElementById("preferredTime");
    if (select) select.selectedIndex = 0;
    if (msg) msg.textContent = "";
  }

  function updateTimer() {
    var now = Date.now();
    var diff = OPEN_DOORS_DATE.getTime() - now;

    var elDays = document.getElementById("days");
    var elHours = document.getElementById("hours");
    var elMinutes = document.getElementById("minutes");
    var elSeconds = document.getElementById("seconds");

    if (diff <= 0) {
      if (elDays) elDays.textContent = "0";
      if (elHours) elHours.textContent = "0";
      if (elMinutes) elMinutes.textContent = "0";
      if (elSeconds) elSeconds.textContent = "0";
      if (!openDoorsAlertShown && elDays) {
        openDoorsAlertShown = true;
        window.alert("День открытых дверей уже начался!");
      }
      return;
    }

    var d = Math.floor(diff / (24 * 60 * 60 * 1000));
    var h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    var m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    var s = Math.floor((diff % (60 * 1000)) / 1000);

    if (elDays) elDays.textContent = String(d);
    if (elHours) elHours.textContent = String(h);
    if (elMinutes) elMinutes.textContent = String(m);
    if (elSeconds) elSeconds.textContent = String(s);
  }

  function onPhoneInput(event) {
    var el = event.target;
    el.value = el.value.replace(/\D/g, "");
  }

  function onPhoneClick(event) {
    event.preventDefault();
    var raw = "74722235510";
    var done = function () {
      window.alert("Скопирован номер телефона");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(raw).then(done).catch(done);
    } else {
      done();
    }
  }

  function setupDirectionCards() {
    var cards = document.querySelectorAll(".direction-card");
    cards.forEach(function (card) {
      card.addEventListener("mouseover", function () {
        card.classList.add("direction-card--js-hover");
      });
      card.addEventListener("mouseout", function () {
        card.classList.remove("direction-card--js-hover");
      });
    });
  }

  function initContacts() {
    var form = document.getElementById("registrationForm");
    if (form) form.addEventListener("submit", submitForm);

    var phoneField = document.getElementById("studentPhone");
    if (phoneField) phoneField.addEventListener("input", onPhoneInput);

    var contactPhone = document.getElementById("contactPhoneLink");
    if (contactPhone) contactPhone.addEventListener("click", onPhoneClick);

    setupDirectionCards();

    if (document.getElementById("countdownDisplay")) {
      updateTimer();
      setInterval(updateTimer, 1000);
    }

    var btnClear = document.querySelector(".contacts-form__btn-clear");
    if (btnClear) btnClear.addEventListener("click", clearForm);

    var btnHome = document.querySelector(".contacts-form__btn-home");
    if (btnHome) {
      btnHome.addEventListener("click", function () {
        window.location.href = "index.html";
      });
    }
  }

  /* ===================================================================
   * 8. ИНИЦИАЛИЗАЦИЯ — запуск модулей по наличию элементов на странице
   * =================================================================== */

  document.addEventListener("DOMContentLoaded", function () {
    initSectionRegistration();
    initTeacherConsultation();
    initCounterAnimation();
    initAdminPanel();
    initContacts();
  });

  window.submitForm = submitForm;
  window.clearForm = clearForm;
})();

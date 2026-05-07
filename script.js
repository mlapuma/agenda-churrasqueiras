const form = document.getElementById("bookingForm");
const dateInput = document.getElementById("dataReserva");
const houseSelect = document.getElementById("casa");
const bookingList = document.getElementById("bookingList");
const emptyState = document.getElementById("emptyState");
const totalReservas = document.getElementById("totalReservas");
const formMessage = document.getElementById("formMessage");
const refreshButton = document.getElementById("atualizarReservas");
const syncStatus = document.getElementById("syncStatus");
const messageModal = document.getElementById("messageModal");
const reservationMessage = document.getElementById("mensagemReserva");
const copyMessageButton = document.getElementById("copiarMensagem");
const closeMessageButton = document.getElementById("fecharMensagem");
const okMessageButton = document.getElementById("okMensagem");
const copyPanel = document.getElementById("copyPanel");
const inlineReservationMessage = document.getElementById("mensagemReservaInline");
const inlineCopyMessageButton = document.getElementById("copiarMensagemInline");

const storageKey = "agendaChurrasqueiraReservas";
const appConfig = window.APP_CONFIG || {};
let bookings = [];

for (let house = 1; house <= 18; house += 1) {
  const option = document.createElement("option");
  option.value = `Casa ${house}`;
  option.textContent = `Casa ${house}`;
  houseSelect.appendChild(option);
}

function getTodayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

dateInput.min = getTodayValue();

function isSupabaseConfigured() {
  return Boolean(appConfig.SUPABASE_URL && appConfig.SUPABASE_ANON_KEY);
}

function getSupabaseHeaders(extraHeaders = {}) {
  return {
    apikey: appConfig.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${appConfig.SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extraHeaders
  };
}

function saveLocalBookings() {
  localStorage.setItem(storageKey, JSON.stringify(bookings));
}

function formatDate(dateValue) {
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function sortBookings() {
  bookings.sort((a, b) => {
    if (a.date === b.date) {
      return a.house.localeCompare(b.house, "pt-BR", { numeric: true });
    }

    return a.date.localeCompare(b.date);
  });
}

function createLocalId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildReservationMessage(booking) {
  return `Comunicado Condominio Terra Branca: ${booking.house} reservou o salao da churrasqueira para o dia ${formatDate(booking.date)}.`;
}

function showReservationMessage(booking) {
  const message = buildReservationMessage(booking);

  reservationMessage.value = message;
  inlineReservationMessage.value = message;
  copyMessageButton.textContent = "Copiar mensagem";
  inlineCopyMessageButton.textContent = "Copiar mensagem";
  copyPanel.hidden = false;
  messageModal.hidden = false;

  setTimeout(() => {
    inlineReservationMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    inlineReservationMessage.focus();
    inlineReservationMessage.select();
  }, 100);
}

function closeReservationMessage() {
  messageModal.hidden = true;
}

async function loadBookings() {
  if (!isSupabaseConfigured()) {
    bookings = JSON.parse(localStorage.getItem(storageKey)) || [];
    syncStatus.textContent = "Modo local: configure o banco online para todos verem as mesmas reservas.";
    renderBookings();
    return;
  }

  try {
    syncStatus.textContent = "Sincronizando reservas online...";
    const today = getTodayValue();
    const response = await fetch(`${appConfig.SUPABASE_URL}/rest/v1/churrasqueira_reservas?select=id,date,house,created_at&date=gte.${today}&order=date.asc`, {
      headers: getSupabaseHeaders()
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel carregar as reservas.");
    }

    bookings = await response.json();
    syncStatus.textContent = "Reservas compartilhadas online.";
    renderBookings();
  } catch (error) {
    bookings = JSON.parse(localStorage.getItem(storageKey)) || [];
    syncStatus.textContent = "Sem conexao com o banco online. Mostrando reservas salvas neste navegador.";
    renderBookings();
  }
}

async function createBooking(booking) {
  if (!isSupabaseConfigured()) {
    bookings.push({ ...booking, id: createLocalId() });
    saveLocalBookings();
    return bookings[bookings.length - 1];
  }

  const response = await fetch(`${appConfig.SUPABASE_URL}/rest/v1/churrasqueira_reservas`, {
    method: "POST",
    headers: getSupabaseHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(booking)
  });

  if (response.status === 409) {
    throw new Error("DATA_RESERVADA");
  }

  if (!response.ok) {
    throw new Error("NAO_SALVOU");
  }

  const [createdBooking] = await response.json();
  return createdBooking;
}

async function deleteBooking(booking) {
  if (!confirm(`Deseja excluir a reserva da ${booking.house} em ${formatDate(booking.date)}?`)) {
    return;
  }

  if (!isSupabaseConfigured()) {
    bookings = bookings.filter((item) => item.id !== booking.id);
    saveLocalBookings();
    renderBookings();
    showMessage("Reserva excluida.");
    return;
  }

  try {
    const response = await fetch(`${appConfig.SUPABASE_URL}/rest/v1/churrasqueira_reservas?id=eq.${booking.id}`, {
      method: "DELETE",
      headers: getSupabaseHeaders()
    });

    if (!response.ok) {
      throw new Error("NAO_EXCLUIU");
    }

    await loadBookings();
    showMessage("Reserva excluida.");
  } catch (error) {
    showMessage("Nao foi possivel excluir a reserva agora.", "error");
  }
}

function renderBookings() {
  bookingList.innerHTML = "";
  bookings = bookings.filter((booking) => booking.date >= getTodayValue());
  sortBookings();

  emptyState.hidden = bookings.length > 0;
  totalReservas.textContent = bookings.length;

  bookings.forEach((booking) => {
    const item = document.createElement("li");
    item.className = "booking-item";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${booking.house}</strong><span>${formatDate(booking.date)}</span>`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Excluir";
    removeButton.addEventListener("click", () => deleteBooking(booking));

    item.append(info, removeButton);
    bookingList.appendChild(item);
  });
}

function showMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", type === "error");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const house = houseSelect.value;

  if (!date || !house) {
    showMessage("Informe a data e a casa.", "error");
    return;
  }

  await loadBookings();

  const reservedDate = bookings.find((booking) => booking.date === date);

  if (reservedDate) {
    showMessage(`${reservedDate.house} ja reservou essa data.`, "error");
    return;
  }

  const booking = {
    date,
    house
  };

  try {
    const createdBooking = await createBooking(booking);
    await loadBookings();
    form.reset();
    dateInput.min = getTodayValue();
    showMessage(`${house} agendada para ${formatDate(date)}.`);
    showReservationMessage(createdBooking);
  } catch (error) {
    if (error.message === "DATA_RESERVADA") {
      await loadBookings();
      const latestReservedDate = bookings.find((bookingItem) => bookingItem.date === date);
      const reservedHouse = latestReservedDate ? latestReservedDate.house : "Outra casa";
      showMessage(`${reservedHouse} ja reservou essa data.`, "error");
      return;
    }

    showMessage("Nao foi possivel salvar a reserva agora.", "error");
  }
});

refreshButton.addEventListener("click", () => {
  loadBookings();
});

async function copyReservationMessage(source, button) {
  source.select();

  try {
    await navigator.clipboard.writeText(source.value);
    button.textContent = "Mensagem copiada";
  } catch (error) {
    document.execCommand("copy");
    button.textContent = "Mensagem copiada";
  }
}

copyMessageButton.addEventListener("click", () => {
  copyReservationMessage(reservationMessage, copyMessageButton);
});

inlineCopyMessageButton.addEventListener("click", () => {
  copyReservationMessage(inlineReservationMessage, inlineCopyMessageButton);
});

closeMessageButton.addEventListener("click", closeReservationMessage);
okMessageButton.addEventListener("click", closeReservationMessage);

messageModal.addEventListener("click", (event) => {
  if (event.target === messageModal) {
    closeReservationMessage();
  }
});

loadBookings();

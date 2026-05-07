const form = document.getElementById("bookingForm");
const dateInput = document.getElementById("dataReserva");
const houseSelect = document.getElementById("casa");
const bookingList = document.getElementById("bookingList");
const emptyState = document.getElementById("emptyState");
const totalReservas = document.getElementById("totalReservas");
const formMessage = document.getElementById("formMessage");
const refreshButton = document.getElementById("atualizarReservas");
const syncStatus = document.getElementById("syncStatus");

const storageKey = "agendaChurrasqueiraReservas";
const appConfig = window.APP_CONFIG || {};
let bookings = [];

for (let house = 1; house <= 18; house += 1) {
  const option = document.createElement("option");
  option.value = `Casa ${house}`;
  option.textContent = `Casa ${house}`;
  houseSelect.appendChild(option);
}

dateInput.min = new Date().toISOString().split("T")[0];

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

function buildMessage(booking) {
  return `Aviso do condominio: ${booking.house} reservou o salao da churrasqueira para o dia ${formatDate(booking.date)}.`;
}

function createLocalId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function shareBooking(booking) {
  const message = buildMessage(booking);

  if (navigator.share) {
    await navigator.share({
      title: "Reserva da churrasqueira",
      text: message
    });
    return;
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, "_blank");
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
    const response = await fetch(`${appConfig.SUPABASE_URL}/rest/v1/churrasqueira_reservas?select=id,date,house,created_at&order=date.asc`, {
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

function renderBookings() {
  bookingList.innerHTML = "";
  sortBookings();

  emptyState.hidden = bookings.length > 0;
  totalReservas.textContent = bookings.length;

  bookings.forEach((booking) => {
    const item = document.createElement("li");
    item.className = "booking-item";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${booking.house}</strong><span>${formatDate(booking.date)}</span>`;

    const actions = document.createElement("div");
    actions.className = "booking-actions";

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "share-button";
    shareButton.textContent = "Avisar";
    shareButton.addEventListener("click", () => shareBooking(booking));

    actions.append(shareButton);
    item.append(info, actions);
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
    dateInput.min = new Date().toISOString().split("T")[0];
    showMessage(`${house} agendada para ${formatDate(date)}.`);
    shareBooking(createdBooking).catch(() => {
      showMessage("Reserva criada. Use o botao Avisar para compartilhar.", "success");
    });
  } catch (error) {
    if (error.message === "DATA_RESERVADA") {
      await loadBookings();
      showMessage("Essa data ja foi reservada por outra casa.", "error");
      return;
    }

    showMessage("Nao foi possivel salvar a reserva agora.", "error");
  }
});

refreshButton.addEventListener("click", () => {
  loadBookings();
});

loadBookings();

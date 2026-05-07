const form = document.getElementById("bookingForm");
const dateInput = document.getElementById("dataReserva");
const houseSelect = document.getElementById("casa");
const bookingList = document.getElementById("bookingList");
const emptyState = document.getElementById("emptyState");
const totalReservas = document.getElementById("totalReservas");
const formMessage = document.getElementById("formMessage");
const clearButton = document.getElementById("limparReservas");

const storageKey = "agendaChurrasqueiraReservas";
let bookings = JSON.parse(localStorage.getItem(storageKey)) || [];

for (let house = 1; house <= 18; house += 1) {
  const option = document.createElement("option");
  option.value = `Casa ${house}`;
  option.textContent = `Casa ${house}`;
  houseSelect.appendChild(option);
}

dateInput.min = new Date().toISOString().split("T")[0];

function saveBookings() {
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

function createId() {
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

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Excluir";
    removeButton.addEventListener("click", () => {
      bookings = bookings.filter((itemBooking) => itemBooking.id !== booking.id);
      saveBookings();
      renderBookings();
      showMessage("Reserva removida.");
    });

    actions.append(shareButton, removeButton);
    item.append(info, actions);
    bookingList.appendChild(item);
  });
}

function showMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", type === "error");
}

form.addEventListener("submit", (event) => {
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
    id: createId(),
    date,
    house
  };

  bookings.push(booking);
  saveBookings();
  renderBookings();
  form.reset();
  dateInput.min = new Date().toISOString().split("T")[0];
  showMessage(`${house} agendada para ${formatDate(date)}.`);
  shareBooking(booking).catch(() => {
    showMessage("Reserva criada. Use o botao Avisar para compartilhar.", "success");
  });
});

clearButton.addEventListener("click", () => {
  if (!bookings.length) {
    showMessage("Nao ha reservas para limpar.");
    return;
  }

  const confirmed = confirm("Deseja apagar todas as reservas?");

  if (!confirmed) {
    return;
  }

  bookings = [];
  saveBookings();
  renderBookings();
  showMessage("Lista de reservas limpa.");
});

renderBookings();

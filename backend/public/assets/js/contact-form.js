const contactForm = document.querySelector("#contactForm");
const validationBox = document.querySelector("#contactValidationBox");

if (contactForm && validationBox) {
  contactForm.addEventListener("submit", (event) => {
    const errors = [];
    const formData = new FormData(contactForm);

    const contactName = String(formData.get("contact_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const messageBody = String(formData.get("message_body") || "").trim();

    if (contactName.length < 2) {
      errors.push("A név legyen legalább 2 karakter hosszú.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Adj meg egy érvényes e-mail címet.");
    }

    if (subject.length < 3) {
      errors.push("A tárgy legalább 3 karakterből álljon.");
    }

    if (messageBody.length < 10) {
      errors.push("Az üzenet legalább 10 karakter hosszú legyen.");
    }

    if (errors.length === 0) {
      validationBox.hidden = true;
      validationBox.innerHTML = "";
      return;
    }

    event.preventDefault();
    validationBox.hidden = false;
    validationBox.innerHTML = `<strong>Ellenőrzési hibák:</strong><ul>${errors
      .map((error) => `<li>${error}</li>`)
      .join("")}</ul>`;
  });
}

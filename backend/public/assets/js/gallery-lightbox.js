"use strict";

(() => {
  const lightbox = document.getElementById("galleryLightbox");
  const lightboxImage = document.getElementById("galleryLightboxImage");
  const lightboxCaption = document.getElementById("galleryLightboxCaption");
  const lightboxMeta = document.getElementById("galleryLightboxMeta");
  const triggers = Array.from(document.querySelectorAll("[data-gallery-image='true']"));

  if (!lightbox || !lightboxImage || !lightboxCaption || !lightboxMeta || triggers.length === 0) {
    return;
  }

  const closeButtons = Array.from(lightbox.querySelectorAll("[data-gallery-close='true']"));
  let lastTrigger = null;

  const openLightbox = (trigger) => {
    lastTrigger = trigger;
    lightboxImage.src = trigger.dataset.imageSrc || "";
    lightboxImage.alt = trigger.dataset.imageAlt || "";
    lightboxCaption.textContent = trigger.dataset.imageCaption || "";
    lightboxMeta.textContent = trigger.dataset.imageMeta || "";
    lightbox.hidden = false;
    document.body.classList.add("has-gallery-lightbox");
  };

  const closeLightbox = () => {
    lightbox.hidden = true;
    lightboxImage.src = "";
    lightboxImage.alt = "";
    lightboxCaption.textContent = "";
    lightboxMeta.textContent = "";
    document.body.classList.remove("has-gallery-lightbox");

    if (lastTrigger instanceof HTMLElement) {
      lastTrigger.focus();
    }
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => openLightbox(trigger));
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeLightbox);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) {
      closeLightbox();
    }
  });
})();

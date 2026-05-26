const forms = document.querySelectorAll('[data-contact-form]');

forms.forEach((form) => {
  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'Sending...';
    setStatus(status, 'Sending your request...', '');

    try {
      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to send request');
      }

      form.reset();
      setStatus(status, result.message || 'Thank you. Your request was received.', 'success');
    } catch {
      setStatus(status, 'Something went wrong. Please call us or try again in a moment.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
});

function setStatus(element, message, state) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.state = state;
}

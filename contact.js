// Contact page form: checks the fields, then sends the message to CONTACT_ENDPOINT.
// The site has no server of its own. To turn sending on, set CONTACT_ENDPOINT to a form service
// endpoint that accepts a POST of form data and answers JSON, such as https://formspree.io/f/<form id>.
// While it is empty the form still checks what was typed but says that sending isn't set up yet.
(function () {
    const CONTACT_ENDPOINT = '';

    const form = document.getElementById('contact-form');
    if (!form) return;

    const status = document.getElementById('contact-status');
    const submit = form.querySelector('button[type="submit"]');
    const fields = {
        name: form.elements.name,
        email: form.elements.email,
        message: form.elements.message,
    };
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!CONTACT_ENDPOINT) document.getElementById('contact-notice').hidden = false;

    function problem(name) {
        const value = fields[name].value.trim();
        if (name === 'name') return value ? '' : 'Enter your name.';
        if (name === 'email') {
            if (!value) return 'Enter your email address.';
            return EMAIL.test(value) ? '' : 'Enter an email address like name@example.com.';
        }
        return value ? '' : 'Enter a message.';
    }

    function showProblem(name, text) {
        const input = fields[name];
        const error = document.getElementById(input.id + '-error');
        error.textContent = text;
        error.hidden = !text;
        if (text) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
    }

    function setStatus(text, kind) {
        status.textContent = text;
        status.dataset.kind = kind || '';
    }

    // Once a field has shown a problem, clear it as soon as the input is fixed
    Object.keys(fields).forEach(name => {
        fields[name].addEventListener('input', () => {
            if (fields[name].hasAttribute('aria-invalid')) showProblem(name, problem(name));
        });
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        let first = null;
        Object.keys(fields).forEach(name => {
            const text = problem(name);
            showProblem(name, text);
            if (text && !first) first = fields[name];
        });
        if (first) {
            setStatus('');
            first.focus();
            return;
        }

        if (!CONTACT_ENDPOINT) {
            setStatus("Sending isn't set up yet, so your message wasn't sent. It's still in the form.", 'error');
            return;
        }

        submit.disabled = true;
        setStatus('Sending…');
        try {
            const response = await fetch(CONTACT_ENDPOINT, {
                method: 'POST',
                body: new FormData(form),
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            form.reset();
            setStatus('Thanks, your message was sent.', 'success');
        } catch (err) {
            setStatus("Your message couldn't be sent. Check your connection and try again.", 'error');
        } finally {
            submit.disabled = false;
        }
    });
})();

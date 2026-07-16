/**
 * Membuat elemen DOM dengan kelas dan teks tertentu.
 * @param {string} tag - Nama tag HTML (e.g., 'div', 'p').
 * @param {string|string[]} [classes=[]] - Kelas CSS yang akan ditambahkan.
 * @param {string} [text=''] - Konten teks untuk elemen.
 * @returns {HTMLElement} Elemen yang telah dibuat.
 */
export function createElement(tag, classes = [], text = '') {
    const el = document.createElement(tag);
    if (Array.isArray(classes)) el.classList.add(...classes);
    else if (typeof classes === 'string' && classes) el.classList.add(...classes.split(' '));
    if (text) el.textContent = text;
    return el;
}
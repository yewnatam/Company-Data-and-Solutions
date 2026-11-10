function normalizeSearch(value) {
  return String(value ?? "").trim().toLowerCase()
    .replace(/[’'.,]/g, "")
    .replace(/\s+/g, " ");
}

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, character => entities[character]);
}

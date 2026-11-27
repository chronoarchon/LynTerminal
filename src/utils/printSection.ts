export function printSection(): void {
  document.body.classList.add("printing-section");
  const cleanup = () => {
    document.body.classList.remove("printing-section");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  setTimeout(cleanup, 1000);
}

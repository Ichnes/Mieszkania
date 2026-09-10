export function createTramStopPopup(
  stop: { name: string; routes: string[] },
  onSelect: (route: string) => void,
) {
  const container = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = stop.name;
  container.append(name, document.createElement("br"));
  const routes = document.createElement("div");
  routes.textContent = "Tramwaje: ";
  for (const route of stop.routes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tram-route-button";
    button.dataset.tramRoute = route;
    button.textContent = route;
    button.setAttribute("aria-label", `Pokaż trasę tramwaju ${route}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(route);
    });
    routes.append(button);
  }
  if (!stop.routes.length) routes.append("brak danych o linii");
  container.append(routes);
  window.L?.DomEvent.disableClickPropagation(container);
  return container;
}

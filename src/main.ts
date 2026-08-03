import { Menu } from "./ui/Menu";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#game canvas not found");
}
// Make the canvas keyboard-focusable so gameplay keys work as soon as it's clicked.
canvas.tabIndex = 0;

// The menu owns the whole app lifecycle: home → profile / host / join → in-game → back.
new Menu(canvas);

import type { Inventory } from "../player/Inventory";
import type { ItemStack } from "../player/Inventory";
import type { Item } from "../items/Item";
import { getItemIcon } from "../items/Item";

/**
 * Inventory UI - handles hotbar and full inventory display.
 * Uses DOM overlay pattern similar to Menu.ts.
 */
export class InventoryUI {
  private inventory: Inventory;
  private hotbarElement: HTMLElement;
  private fullInventoryElement: HTMLElement | null = null;
  private isOpen: boolean = false;
  
  // Hotbar element IDs
  private readonly HOTBAR_ID = "hotbar";
  private readonly FULL_INVENTORY_ID = "full-inventory";
  
  constructor(inventory: Inventory) {
    this.inventory = inventory;
    this.hotbarElement = this.createHotbar();
    this.updateHotbar();
  }

  /** Get the hotbar DOM element to append to the game container. */
  getHotbarElement(): HTMLElement {
    return this.hotbarElement;
  }

  /** Toggle the full inventory UI. */
  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.showFullInventory();
    } else {
      this.hideFullInventory();
    }
  }

  /** Close the full inventory UI. */
  close(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.hideFullInventory();
    }
  }

  /** Update the hotbar display (call after inventory changes). */
  updateHotbar(): void {
    const slots = this.inventory.getHotbar();
    const selectedIndex = this.inventory.getSelectedIndex();
    
    this.hotbarElement.innerHTML = "";
    
    for (let i = 0; i < slots.length; i++) {
      const slot = this.createSlot(slots[i], i === selectedIndex, i + 1);
      this.hotbarElement.appendChild(slot);
    }
  }

  /** Update the full inventory display (call after inventory changes). */
  updateFullInventory(): void {
    if (!this.fullInventoryElement) return;
    
    const hotbarSlots = this.inventory.getHotbar();
    const mainSlots = this.inventory.getMainInventory();
    const selectedIndex = this.inventory.getSelectedIndex();
    
    this.fullInventoryElement.innerHTML = "";
    
    // Hotbar section
    const hotbarSection = document.createElement("div");
    hotbarSection.className = "inventory-section";
    hotbarSection.innerHTML = "<div class='inventory-section-title'>Hotbar (1-0)</div>";
    
    const hotbarGrid = document.createElement("div");
    hotbarGrid.className = "inventory-grid";
    
    for (let i = 0; i < hotbarSlots.length; i++) {
      const slot = this.createSlot(hotbarSlots[i], i === selectedIndex, i + 1, true);
      hotbarGrid.appendChild(slot);
    }
    
    hotbarSection.appendChild(hotbarGrid);
    this.fullInventoryElement.appendChild(hotbarSection);
    
    // Main inventory section
    const mainSection = document.createElement("div");
    mainSection.className = "inventory-section";
    mainSection.innerHTML = "<div class='inventory-section-title'>Inventory</div>";
    
    const mainGrid = document.createElement("div");
    mainGrid.className = "inventory-grid";
    
    for (let i = 0; i < mainSlots.length; i++) {
      const slot = this.createSlot(mainSlots[i], false, null, true);
      mainGrid.appendChild(slot);
    }
    
    mainSection.appendChild(mainGrid);
    this.fullInventoryElement.appendChild(mainSection);
    
    // Creative/survival toggle
    const toggleSection = document.createElement("div");
    toggleSection.className = "inventory-section";
    toggleSection.innerHTML = `
      <div class='inventory-toggle'>
        <button id='creative-toggle' class='inventory-toggle-btn'>
          ${this.inventory['creative'] ? 'Creative: ON' : 'Creative: OFF'}
        </button>
      </div>
    `;
    this.fullInventoryElement.appendChild(toggleSection);
    
    // Wire up toggle button
    const toggleBtn = this.fullInventoryElement.querySelector('#creative-toggle') as HTMLButtonElement;
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        this.inventory.setCreative(!this.inventory['creative']);
        this.updateFullInventory();
      };
    }
  }

  /** Create a single inventory slot element. */
  private createSlot(
    stack: ItemStack | null,
    selected: boolean,
    hotkey: number | null,
    clickable: boolean = false
  ): HTMLElement {
    const slot = document.createElement("div");
    slot.className = `inventory-slot ${selected ? "selected" : ""}`;
    
    if (stack) {
      const icon = getItemIcon(stack.item);
      if (icon) {
        const img = document.createElement("img");
        img.src = icon;
        img.className = "inventory-slot-icon";
        slot.appendChild(img);
      }
      
      if (stack.count > 1) {
        const count = document.createElement("div");
        count.className = "inventory-slot-count";
        count.textContent = stack.count.toString();
        slot.appendChild(count);
      }
      
      if (clickable) {
        slot.onclick = () => {
          // For creative mode, clicking selects the item
          if (this.inventory['creative']) {
            // Find the hotbar slot with this item or empty slot
            const hotbarSlots = this.inventory.getHotbar();
            let targetIndex = -1;
            
            for (let i = 0; i < hotbarSlots.length; i++) {
              if (hotbarSlots[i] && hotbarSlots[i]!.item.id === stack.item.id) {
                targetIndex = i;
                break;
              }
              if (hotbarSlots[i] === null) {
                targetIndex = i;
                break;
              }
            }
            
            if (targetIndex >= 0) {
              this.inventory.setHotbarSlot(targetIndex, { ...stack });
              this.inventory.setSelectedIndex(targetIndex);
              this.updateHotbar();
              this.updateFullInventory();
            }
          }
        };
      }
    }
    
    if (hotkey !== null) {
      const key = document.createElement("div");
      key.className = "inventory-slot-key";
      key.textContent = hotkey.toString();
      slot.appendChild(key);
    }
    
    return slot;
  }

  /** Create the hotbar container element. */
  private createHotbar(): HTMLElement {
    const hotbar = document.createElement("div");
    hotbar.id = this.HOTBAR_ID;
    hotbar.className = "hotbar";
    return hotbar;
  }

  /** Show the full inventory overlay. */
  private showFullInventory(): void {
    if (this.fullInventoryElement) return;
    
    this.fullInventoryElement = document.createElement("div");
    this.fullInventoryElement.id = this.FULL_INVENTORY_ID;
    this.fullInventoryElement.className = "full-inventory";
    
    this.updateFullInventory();
    document.body.appendChild(this.fullInventoryElement);
  }

  /** Hide the full inventory overlay. */
  private hideFullInventory(): void {
    if (this.fullInventoryElement) {
      this.fullInventoryElement.remove();
      this.fullInventoryElement = null;
    }
  }
}

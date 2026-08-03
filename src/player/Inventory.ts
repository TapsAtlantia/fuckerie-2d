import { TileId, tile } from "../world/Tile";
import type { Item } from "../items/Item";
import { INVENTORY } from "../config";

export type ItemStack = {
  item: Item;
  count: number;
};

export class Inventory {
  private hotbarSlots: (ItemStack | null)[] = [];
  private mainSlots: (ItemStack | null)[] = [];
  private selectedSlot: number = 0;
  private creative: boolean = false;
  
  readonly hotbarSize: number = INVENTORY.HOTBAR_SIZE;
  readonly mainInventorySize: number = INVENTORY.MAIN_INVENTORY_SIZE;

  constructor(creative: boolean = false) {
    this.creative = creative;
    this.clear();
  }

  /** Clear all slots. */
  clear(): void {
    this.hotbarSlots = new Array(this.hotbarSize).fill(null);
    this.mainSlots = new Array(this.mainInventorySize).fill(null);
    this.selectedSlot = 0;
  }

  /** Set creative mode (unlimited blocks, no consumption). */
  setCreative(creative: boolean): void {
    this.creative = creative;
  }

  /** Get the currently selected hotbar slot. */
  getSelected(): ItemStack | null {
    return this.hotbarSlots[this.selectedSlot];
  }

  /** Get the selected slot index. */
  getSelectedIndex(): number {
    return this.selectedSlot;
  }

  /** Set the selected hotbar slot index. */
  setSelectedIndex(index: number): void {
    if (index >= 0 && index < this.hotbarSize) {
      this.selectedSlot = index;
    }
  }

  /** Get all hotbar slots. */
  getHotbar(): readonly (ItemStack | null)[] {
    return this.hotbarSlots;
  }

  /** Get all main inventory slots. */
  getMainInventory(): readonly (ItemStack | null)[] {
    return this.mainSlots;
  }

  /** Add an item to the inventory, stacking if possible. Returns true if added. */
  addItem(item: Item, count: number = 1): boolean {
    if (this.creative) return true; // Creative doesn't need to track items
    
    // Try to stack in hotbar first
    for (let i = 0; i < this.hotbarSlots.length; i++) {
      const slot = this.hotbarSlots[i];
      if (slot && slot.item.id === item.id && slot.count < item.maxStack) {
        const canAdd = Math.min(count, item.maxStack - slot.count);
        slot.count += canAdd;
        count -= canAdd;
        if (count <= 0) return true;
      }
    }
    
    // Try to stack in main inventory
    for (let i = 0; i < this.mainSlots.length; i++) {
      const slot = this.mainSlots[i];
      if (slot && slot.item.id === item.id && slot.count < item.maxStack) {
        const canAdd = Math.min(count, item.maxStack - slot.count);
        slot.count += canAdd;
        count -= canAdd;
        if (count <= 0) return true;
      }
    }
    
    // Try to find empty slot in hotbar
    for (let i = 0; i < this.hotbarSlots.length; i++) {
      if (this.hotbarSlots[i] === null) {
        this.hotbarSlots[i] = { item, count: Math.min(count, item.maxStack) };
        return true;
      }
    }
    
    // Try to find empty slot in main inventory
    for (let i = 0; i < this.mainSlots.length; i++) {
      if (this.mainSlots[i] === null) {
        this.mainSlots[i] = { item, count: Math.min(count, item.maxStack) };
        return true;
      }
    }
    
    return false; // Inventory full
  }

  /** Remove items from the selected slot. Returns the actual count removed. */
  removeFromSelected(count: number): number {
    if (this.creative) return count; // Creative has infinite items
    
    const slot = this.hotbarSlots[this.selectedSlot];
    if (!slot) return 0;
    
    const toRemove = Math.min(count, slot.count);
    slot.count -= toRemove;
    
    if (slot.count <= 0) {
      this.hotbarSlots[this.selectedSlot] = null;
    }
    
    return toRemove;
  }

  /** Set a specific hotbar slot. */
  setHotbarSlot(index: number, stack: ItemStack | null): void {
    if (index >= 0 && index < this.hotbarSize) {
      this.hotbarSlots[index] = stack;
    }
  }

  /** Set a specific main inventory slot. */
  setMainSlot(index: number, stack: ItemStack | null): void {
    if (index >= 0 && index < this.mainInventorySize) {
      this.mainSlots[index] = stack;
    }
  }

  /** Get the tile ID of the selected item (if placeable). */
  getSelectedTile(): TileId | null {
    const slot = this.getSelected();
    if (slot && slot.item.placeable !== null) {
      return slot.item.placeable;
    }
    return null;
  }

  /** Check if the selected slot has enough of the required item. */
  hasSelected(tileId: TileId, count: number = 1): boolean {
    if (this.creative) return true;
    
    const slot = this.getSelected();
    if (!slot || slot.item.placeable !== tileId) return false;
    return slot.count >= count;
  }

  /** Consume items from the selected slot (for placing). */
  consumeSelected(count: number = 1): boolean {
    if (this.creative) return true;
    
    const slot = this.getSelected();
    if (!slot) return false;
    
    if (slot.count < count) return false;
    
    slot.count -= count;
    if (slot.count <= 0) {
      this.hotbarSlots[this.selectedSlot] = null;
    }
    
    return true;
  }

  /** Swap items between slots (for inventory UI drag-and-drop). */
  swapSlots(fromHotbar: boolean, fromIndex: number, toHotbar: boolean, toIndex: number): void {
    const fromArray = fromHotbar ? this.hotbarSlots : this.mainSlots;
    const toArray = toHotbar ? this.hotbarSlots : this.mainSlots;
    
    if (fromIndex < 0 || fromIndex >= fromArray.length) return;
    if (toIndex < 0 || toIndex >= toArray.length) return;
    
    const temp = fromArray[fromIndex];
    fromArray[fromIndex] = toArray[toIndex];
    toArray[toIndex] = temp;
  }
}

import SelectionGroupManager from "../../gtComponents/selectionGroupManager";

export const debugSelectionGroupManager = (
  selectionGroupManager: SelectionGroupManager
) => {
  const selectionGroupManagerDebug = selectionGroupManager.debug?.ui?.addFolder(
    "selectionGroupManager"
  );

  selectionGroupManagerDebug?.open();

  selectionGroupManagerDebug
    ?.add(selectionGroupManager.selectionGroup0, "length")
    .name("# of group 0")
    .listen();
  selectionGroupManagerDebug
    ?.add(selectionGroupManager.selectionGroup1, "length")
    .name("# of group 1")
    .listen();
  selectionGroupManagerDebug
    ?.add(selectionGroupManager.selectionGroup2, "length")
    .name("# of group 2")
    .listen();
  selectionGroupManagerDebug
    ?.add(selectionGroupManager, "activeSelectionGroup")
    .name("active group")
    .listen();
};

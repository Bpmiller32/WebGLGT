import World from "../../levels/world";

export const debugWorld = (world: World) => {
  const worldDebug = world.debug?.ui?.addFolder("world");

  worldDebug?.open();

  worldDebug
    ?.add(world, "renderObjectCount")
    .name("# of renderObjects")
    .listen();
  worldDebug
    ?.add(world.experience.sizes, "width")
    .name("renderer width")
    .listen();
  worldDebug
    ?.add(world.experience.sizes, "height")
    .name("renderer height")
    .listen();
};

export const debugWorldUpdate = (world: World) => {
  // Update render object count
  let entityCount = 0;

  world.scene.traverse(() => {
    entityCount++;
  });

  world.renderObjectCount = entityCount;
};

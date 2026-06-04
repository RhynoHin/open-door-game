import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const canvas = document.getElementById("game");
const menuPanel = document.getElementById("menu-panel");
const startBtn = document.getElementById("start-btn");
const objective = document.getElementById("objective");
const inventory = document.getElementById("inventory");
const toast = document.getElementById("toast");
const controlButtons = document.querySelectorAll(".ctrl-btn");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101521);
scene.fog = new THREE.Fog(0x101521, 7, 15);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 60);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const interactables = [];
const particles = [];
const temp = new THREE.Vector3();

const colors = {
  wall: 0x2d3147,
  trim: 0x6f587f,
  floor: 0x30344a,
  rose: 0xff8db3,
  mint: 0x8df2d2,
  gold: 0xffd56f,
  cream: 0xfff5d8,
  ink: 0x34313d,
  blue: 0x86b7ff,
};

const game = {
  started: false,
  won: false,
  yaw: 0,
  targetYaw: 0,
  drag: null,
  stars: 0,
  selected: null,
  hintIndex: 0,
  clockStep: 0,
  pillowOpen: false,
  lanterns: [-1, -1, -1],
  solved: {
    clock: false,
    pillow: false,
    lanterns: false,
  },
  doorOpen: 0,
  toastUntil: 0,
};

const mats = {
  wall: new THREE.MeshStandardMaterial({ color: colors.wall, roughness: 0.72 }),
  trim: new THREE.MeshStandardMaterial({ color: colors.trim, roughness: 0.58 }),
  floor: new THREE.MeshStandardMaterial({ color: colors.floor, roughness: 0.68 }),
  cream: new THREE.MeshStandardMaterial({ color: colors.cream, roughness: 0.5 }),
  ink: new THREE.MeshStandardMaterial({ color: colors.ink, roughness: 0.5 }),
  rose: new THREE.MeshStandardMaterial({ color: colors.rose, roughness: 0.46, emissive: 0x351522 }),
  mint: new THREE.MeshStandardMaterial({ color: colors.mint, roughness: 0.36, emissive: 0x123228 }),
  gold: new THREE.MeshStandardMaterial({ color: colors.gold, roughness: 0.38, emissive: 0x362710 }),
  blue: new THREE.MeshStandardMaterial({ color: colors.blue, roughness: 0.42, emissive: 0x17233d }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xbfefff,
    roughness: 0.16,
    metalness: 0.05,
    transparent: true,
    opacity: 0.62,
    emissive: 0x1e5260,
  }),
};

function box(name, size, position, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function sphere(name, radius, position, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 18), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function cyl(name, radius, height, position, material, sides = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addInteractable(mesh, label, action) {
  mesh.userData.label = label;
  mesh.userData.action = action;
  interactables.push(mesh);
  return mesh;
}

function makeStar(name, position, scale = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.18 : 0.08;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012 }),
    mats.gold,
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

function buildRoom() {
  box("floor", [7.4, 0.16, 7.4], [0, -0.08, 0], mats.floor, false);
  box("back wall", [7.4, 3.5, 0.18], [0, 1.7, -3.7], mats.wall, false);
  box("left wall", [0.18, 3.5, 7.4], [-3.7, 1.7, 0], mats.wall, false);
  box("right wall", [0.18, 3.5, 7.4], [3.7, 1.7, 0], mats.wall, false);
  box("ceiling glow", [7.4, 0.08, 7.4], [0, 3.45, 0], mats.trim, false);

  for (let i = -3; i <= 3; i += 1) {
    box("floor stripe", [0.035, 0.01, 7.2], [i, 0.005, 0], mats.trim, false);
    box("floor stripe", [7.2, 0.01, 0.035], [0, 0.006, i], mats.trim, false);
  }

  const doorFrame = box("door frame", [1.6, 2.55, 0.16], [0, 1.26, -3.58], mats.trim);
  doorFrame.userData.decor = true;
  game.door = box("moon door", [1.25, 2.15, 0.14], [0, 1.1, -3.45], mats.blue);
  addInteractable(game.door, "月亮門", () => {
    if (game.stars < 3) return say(`門上水晶仲欠 ${3 - game.stars} 粒星光。`);
    openDoor();
  });

  const moon = sphere("door moon", 0.22, [0, 1.75, -3.33], mats.cream, [1, 1, 0.18]);
  addInteractable(moon, "門上月亮", () => {
    if (game.stars < 3) say("月亮細聲講：三粒星光一齊嚟，門就會開。");
    else openDoor();
  });

  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 56), mats.rose);
  rug.name = "round rug";
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0.3);
  rug.receiveShadow = true;
  scene.add(rug);
}

function buildMochi() {
  const group = new THREE.Group();
  group.name = "Mochi";
  group.position.set(-2.1, 0.72, -1.2);
  scene.add(group);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 36, 22), mats.cream);
  body.scale.set(1, 1.08, 0.9);
  body.castShadow = true;
  group.add(body);

  const earA = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 24), mats.cream);
  earA.position.set(-0.27, 0.37, 0);
  earA.rotation.z = 0.34;
  earA.castShadow = true;
  group.add(earA);
  const earB = earA.clone();
  earB.position.x = 0.27;
  earB.rotation.z = -0.34;
  group.add(earB);

  const eyeA = sphere("eye", 0.045, [-2.25, 0.84, -0.82], mats.ink);
  const eyeB = sphere("eye", 0.045, [-1.95, 0.84, -0.82], mats.ink);
  const blushA = sphere("blush", 0.055, [-2.33, 0.72, -0.84], mats.rose, [1, 0.65, 0.35]);
  const blushB = sphere("blush", 0.055, [-1.87, 0.72, -0.84], mats.rose, [1, 0.65, 0.35]);
  [eyeA, eyeB, blushA, blushB].forEach((part) => {
    part.userData.decor = true;
  });

  addInteractable(body, "Mochi", () => {
    say(game.stars < 3 ? "Mochi：我聞到星光喺鐘、枕頭同燈籠入面。" : "Mochi：門開喇，快啲走！");
    burst(new THREE.Vector3(-2.1, 1.12, -1.2), colors.rose, 18);
  });
  game.mochi = group;
}

function buildPuzzles() {
  const clockBase = cyl("star clock", 0.48, 0.12, [2.35, 1.45, -3.42], mats.cream);
  clockBase.rotation.x = Math.PI / 2;
  addInteractable(clockBase, "星星鐘", () => {
    if (game.solved.clock) return say("星星鐘已經送咗一粒星光。");
    game.clockStep = (game.clockStep + 1) % 4;
    game.clockHand.rotation.z = (-Math.PI / 2) * game.clockStep;
    burst(clockBase.position, colors.gold, 10);
    if (game.clockStep === 3) solve("clock", "星星鐘轉到三點，第一粒星光飛咗出嚟。", clockBase.position);
    else say(["鐘面畫住一、二、三粒月牙。", "指針卡住，似乎要再轉。", "差少少，Mochi 對住第三粒月牙眨眼。"][game.clockStep]);
  });
  game.clockHand = box("clock hand", [0.08, 0.58, 0.05], [2.35, 1.45, -3.27], mats.gold);
  game.clockHand.userData.decor = true;

  const pillow = sphere("cloud pillow", 0.46, [-2.25, 0.44, 1.7], mats.mint, [1.35, 0.62, 0.82]);
  addInteractable(pillow, "雲朵枕頭", () => {
    if (game.solved.pillow) return say("枕頭入面只剩低軟綿綿嘅雲。");
    game.pillowOpen = !game.pillowOpen;
    pillow.scale.y = game.pillowOpen ? 0.34 : 0.62;
    pillow.material = game.pillowOpen ? mats.gold : mats.mint;
    if (game.pillowOpen) solve("pillow", "你拍扁雲朵枕頭，第二粒星光彈咗出嚟。", pillow.position);
    else say("枕頭好鬆軟，好似藏住嘢。");
  });

  const lanternColors = [mats.rose, mats.mint, mats.gold];
  game.lanternMeshes = [-1.05, 0, 1.05].map((x, index) => {
    cyl(`lantern stand ${index}`, 0.2, 0.8, [x, 0.4, 2.15], mats.trim, 18);
    const lamp = sphere(`lantern ${index}`, 0.24, [x, 0.98, 2.15], mats.blue);
    addInteractable(lamp, `星燈 ${index + 1}`, () => {
      if (game.solved.lanterns) return say("三盞星燈已經排好顏色。");
      game.lanterns[index] = (game.lanterns[index] + 1) % 3;
      lamp.material = lanternColors[game.lanterns[index]];
      burst(lamp.position, [colors.rose, colors.mint, colors.gold][game.lanterns[index]], 9);
      if (game.lanterns.join(",") === "0,1,2") solve("lanterns", "粉紅、薄荷、金色順序亮起，最後一粒星光出現。", lamp.position);
      else say("牆上小旗寫住：粉紅、薄荷、金色。");
    });
    return lamp;
  });

  const shelf = box("toy shelf", [1.35, 0.28, 0.55], [-2.35, 1.15, -3.25], mats.trim);
  addInteractable(shelf, "玩具架", () => say("玩具架貼住紙條：鐘面要跟住三粒月牙。"));
  box("toy shelf base", [1.5, 0.18, 0.5], [-2.35, 0.68, -3.25], mats.trim);

  const flagMats = [mats.rose, mats.mint, mats.gold];
  [-0.35, 0, 0.35].forEach((x, i) => {
    const flag = box("color flag", [0.24, 0.18, 0.04], [x + 1.55, 1.9, -3.28], flagMats[i], false);
    flag.userData.decor = true;
  });
}

function buildLighting() {
  scene.add(new THREE.HemisphereLight(0xfaf2ff, 0x202233, 1.85));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2.8, 5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const doorLight = new THREE.PointLight(colors.blue, 2.8, 5);
  doorLight.position.set(0, 2.1, -2.6);
  scene.add(doorLight);
  const roseLight = new THREE.PointLight(colors.rose, 1.6, 4);
  roseLight.position.set(-2.3, 1.7, 1.2);
  scene.add(roseLight);
  const mintLight = new THREE.PointLight(colors.mint, 1.4, 4);
  mintLight.position.set(2.2, 1.4, 1.7);
  scene.add(mintLight);
}

function addAmbientSparkles() {
  for (let i = 0; i < 44; i += 1) {
    const star = makeStar("ambient sparkle", [(Math.random() - 0.5) * 6.4, 1 + Math.random() * 2.1, -3.25 + Math.random() * 6], 0.22);
    star.material = mats.glass;
    star.userData.float = Math.random() * 6.28;
    star.userData.decor = true;
    particles.push({ mesh: star, ambient: true, life: Infinity, baseY: star.position.y });
  }
}

function solve(key, message, position) {
  if (game.solved[key]) return;
  game.solved[key] = true;
  game.stars += 1;
  say(message);
  updateHud();
  burst(position.clone ? position : new THREE.Vector3(position.x, position.y, position.z), colors.gold, 34);
  if (game.stars === 3) {
    setTimeout(() => {
      say("三粒星光集齊，門口月亮水晶開始發光。");
      burst(new THREE.Vector3(0, 1.5, -3.1), colors.mint, 56);
    }, 450);
  }
}

function openDoor() {
  if (game.won) return;
  game.won = true;
  say("月亮門打開喇！Mochi 跳住離開密室。");
  objective.textContent = "成功逃出月光玩具房";
  burst(new THREE.Vector3(0, 1.25, -2.8), colors.gold, 120);
}

function burst(position, color, count) {
  for (let i = 0; i < count; i += 1) {
    const mesh = sphere("particle", 0.035 + Math.random() * 0.035, [position.x, position.y, position.z], mats.gold);
    mesh.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    particles.push({
      mesh,
      life: 0.7 + Math.random() * 0.6,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.8, Math.random() * 1.8 + 0.2, (Math.random() - 0.5) * 1.8),
    });
  }
}

function updateHud() {
  const left = 3 - game.stars;
  objective.textContent = game.won ? "成功逃出月光玩具房" : left > 0 ? `搵齊星光，仲欠 ${left} 粒` : "點門口月亮水晶開門";
  inventory.textContent = `星光 ${game.stars}/3`;
}

function say(text, seconds = 2.5) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  game.toastUntil = performance.now() + seconds * 1000;
}

function showHint() {
  const hints = [
    "先望吓玩具架同牆上小旗，佢哋係線索。",
    "星星鐘要轉到第三個位置。",
    "雲朵枕頭可以拍一拍。",
    "三盞星燈次序係粉紅、薄荷、金色。",
  ];
  say(hints[game.hintIndex % hints.length], 3);
  game.hintIndex += 1;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
}

function pick(event = null, useCenter = false) {
  if (useCenter) {
    pointer.set(0, 0);
  } else if (event) {
    setPointerFromEvent(event);
  }
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  return hits[0]?.object || null;
}

function interact(event = null) {
  if (!game.started) return;
  const mesh = pick(event, !event);
  if (!mesh) {
    say("呢邊冇嘢可以摸，拖動畫面望吓其他角落。", 1.7);
    return;
  }
  mesh.userData.action();
}

function startGame() {
  game.started = true;
  menuPanel.classList.add("hidden");
  updateHud();
  say("搵三粒星光。點鐘、枕頭、燈籠或者 Mochi 試吓。", 3);
}

function resetGame() {
  window.location.reload();
}

function handleAction(action) {
  if (action === "left") game.targetYaw -= 0.45;
  if (action === "right") game.targetYaw += 0.45;
  if (action === "interact") interact();
  if (action === "hint") showHint();
  if (action === "reset") resetGame();
}

function updateCamera() {
  game.yaw += (game.targetYaw - game.yaw) * 0.11;
  const radius = 5.35;
  const target = temp.set(0, 1.15, -0.25);
  camera.position.set(Math.sin(game.yaw) * radius, 1.75, Math.cos(game.yaw) * radius + 0.2);
  camera.lookAt(target);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  const now = performance.now();
  if (game.toastUntil && now > game.toastUntil) toast.classList.add("hidden");

  updateCamera();

  if (game.mochi) {
    game.mochi.position.y = 0.72 + Math.sin(now * 0.003) * 0.045;
    game.mochi.rotation.y = Math.sin(now * 0.0017) * 0.13;
  }

  if (game.won) {
    game.doorOpen = Math.min(1, game.doorOpen + dt * 0.85);
    game.door.rotation.y = -game.doorOpen * 1.2;
    game.door.position.x = -Math.sin(game.doorOpen * 1.2) * 0.55;
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    if (p.ambient) {
      p.mesh.rotation.z += dt * 0.45;
      p.mesh.position.y = p.baseY + Math.sin(now * 0.0015 + p.mesh.userData.float) * 0.05;
      continue;
    }
    p.life -= dt;
    p.velocity.y -= dt * 1.8;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.rotation.x += dt * 3;
    p.mesh.rotation.y += dt * 2;
    p.mesh.material.opacity = Math.max(0, p.life);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

startBtn.addEventListener("click", startGame);

canvas.addEventListener("pointerdown", (event) => {
  game.drag = { x: event.clientX, yaw: game.targetYaw, moved: false };
});

canvas.addEventListener("pointermove", (event) => {
  if (!game.drag) return;
  const dx = event.clientX - game.drag.x;
  if (Math.abs(dx) > 8) game.drag.moved = true;
  game.targetYaw = game.drag.yaw - dx * 0.006;
});

canvas.addEventListener("pointerup", (event) => {
  if (!game.drag) return;
  const wasTap = !game.drag.moved;
  game.drag = null;
  if (wasTap) interact(event);
});

controlButtons.forEach((button) => {
  button.addEventListener("click", () => handleAction(button.dataset.action));
});

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 120));

buildRoom();
buildMochi();
buildPuzzles();
buildLighting();
addAmbientSparkles();
resize();
updateHud();
animate();

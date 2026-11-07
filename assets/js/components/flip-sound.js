// Suara balik halaman sederhana dari WebAudio (tanpa file audio).
let ctx = null;

export function playFlip() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  const length = ctx.sampleRate * 0.18;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2 * 0.25;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1800;
  source.buffer = buffer;
  source.connect(filter).connect(ctx.destination);
  source.start();
}

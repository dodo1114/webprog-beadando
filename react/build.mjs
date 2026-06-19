import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(import.meta.dirname, "dist", "assets");

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    "react-crud": resolve(import.meta.dirname, "src", "react-crud.jsx"),
    "spa-app": resolve(import.meta.dirname, "src", "spa-app.jsx"),
    "axios-app": resolve(import.meta.dirname, "src", "axios-app.jsx")
  },
  bundle: true,
  format: "iife",
  target: ["es2020"],
  outdir,
  jsx: "automatic",
  minify: true
});

const chunkSize = 30000;
for (const entry of ["react-crud", "spa-app", "axios-app"]) {
  const bundlePath = resolve(outdir, `${entry}.js`);
  const bundle = await readFile(bundlePath);
  const encoded = bundle.toString("base64");
  const chunks = [];
  for (let offset = 0; offset < encoded.length; offset += chunkSize) {
    chunks.push(encoded.slice(offset, offset + chunkSize));
  }
  await Promise.all(chunks.map((chunk, index) =>
    writeFile(resolve(outdir, `${entry}.part${String(index).padStart(2, "0")}.txt`), chunk, "ascii")
  ));
  const loader = `(async()=>{const s=document.currentScript.src,p=[];for(let i=0;i<${chunks.length};i++){const n=String(i).padStart(2,"0");p.push(await(await fetch(new URL("${entry}.part"+n+".txt",s))).text())}const b=atob(p.join("")),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);const x=URL.createObjectURL(new Blob([u],{type:"text/javascript"}));try{await import(x)}finally{URL.revokeObjectURL(x)}})();`;
  await writeFile(bundlePath, loader, "utf8");
}

for (const file of ["react.html", "spa.html", "axios.html"]) {
  const html = await readFile(resolve(root, file), "utf8");
  await writeFile(
    resolve(import.meta.dirname, "dist", file),
    html.replaceAll("react/dist/assets/", "assets/"),
    "utf8"
  );
}

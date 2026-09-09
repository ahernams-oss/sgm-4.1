import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import { Loader2 } from "lucide-react";

interface BimViewerProps {
  url: string;
  formato: string;
}

/**
 * Visualizador 3D para arquivos IFC. Para outros formatos exibe mensagem.
 */
export default function BimViewer({ url, formato }: BimViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    if (formato.toUpperCase() !== "IFC") {
      setLoading(false);
      return;
    }
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight || 500;

    // Cena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    // Câmera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(15, 13, 15);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    // Luzes
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    // Grid
    const grid = new THREE.GridHelper(50, 50, 0xcccccc, 0xeeeeee);
    scene.add(grid);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // IFC Loader
    const ifcLoader = new IFCLoader();
    ifcLoader.ifcManager.setWasmPath("https://unpkg.com/web-ifc@0.0.50/");

    let cancelled = false;

    ifcLoader.load(
      url,
      (model) => {
        if (cancelled) return;
        scene.add(model);
        // Centralizar câmera no modelo
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(center.x + maxDim, center.y + maxDim * 0.8, center.z + maxDim);
        controls.target.copy(center);
        controls.update();
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error("Erro ao carregar IFC:", err);
        setError("Não foi possível carregar o modelo IFC.");
        setLoading(false);
      }
    );

    // Animação
    let frameId: number;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight || 500;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [url, formato]);

  if (!url) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground">
        Nenhum arquivo carregado
      </div>
    );
  }

  if (formato.toUpperCase() !== "IFC") {
    return (
      <div className="flex h-[500px] flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-6 text-center">
        <p className="text-muted-foreground">
          O visualizador 3D nativo suporta apenas arquivos <strong>IFC</strong>.<br />
          Para o formato <strong>{formato}</strong>, faça o download do arquivo abaixo.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Baixar arquivo {formato}
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-lg border">
      <div ref={mountRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando modelo IFC...
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4 text-center text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

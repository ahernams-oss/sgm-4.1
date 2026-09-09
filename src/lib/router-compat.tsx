/* Minimal React Router v6 compatible layer built on the History API.
 * Allows the SGM app tree to run unchanged inside the TanStack Start shell. */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

export type To = string | { pathname?: string; search?: string; hash?: string };

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
}

interface RouterCtx {
  location: Location;
  navigate: (to: To, opts?: { replace?: boolean; state?: unknown }) => void;
}

function readLocation(): Location {
  if (typeof window === "undefined") {
    return { pathname: "/", search: "", hash: "", state: null, key: "ssr" };
  }
  const { pathname, search, hash } = window.location;
  return {
    pathname,
    search,
    hash,
    state: window.history.state?.usr ?? null,
    key: String(window.history.state?.key ?? "default"),
  };
}

export function resolveTo(to: To): string {
  if (typeof to === "string") return to;
  return `${to.pathname ?? window.location.pathname}${to.search ?? ""}${to.hash ?? ""}`;
}

const Ctx = createContext<RouterCtx | null>(null);
const ParamsCtx = createContext<Record<string, string>>({});

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(() => readLocation());

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback<RouterCtx["navigate"]>((to, opts) => {
    if (typeof to === "number") return;
    const url = resolveTo(to);
    const state = { usr: opts?.state ?? null, key: String(Date.now()) };
    if (opts?.replace) window.history.replaceState(state, "", url);
    else window.history.pushState(state, "", url);
    setLocation(readLocation());
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const MemoryRouter = BrowserRouter;
export const HashRouter = BrowserRouter;

function useRouter(): RouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Router context missing: wrap the app in <BrowserRouter>");
  return ctx;
}

export function useLocation(): Location {
  return useRouter().location;
}

export type NavigateFunction = (to: To | number, opts?: { replace?: boolean; state?: unknown }) => void;

export function useNavigate(): NavigateFunction {
  const { navigate } = useRouter();
  return useCallback<NavigateFunction>(
    (to, opts) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      navigate(to, opts);
    },
    [navigate],
  );
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(ParamsCtx) as T;
}

export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string> | string, opts?: { replace?: boolean }) => void,
] {
  const { location, navigate } = useRouter();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const setParams = useCallback(
    (
      next: URLSearchParams | Record<string, string> | string,
      opts?: { replace?: boolean },
    ) => {
      const sp =
        next instanceof URLSearchParams
          ? next
          : new URLSearchParams(next as Record<string, string> | string);
      const qs = sp.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : "" }, { replace: opts?.replace });
    },
    [location.pathname, navigate],
  );
  return [params, setParams];
}

/* ---------- matching ---------- */

interface MatchResult {
  params: Record<string, string>;
  score: number;
}

export function matchPath(pattern: string, pathname: string): MatchResult | null {
  const clean = (s: string) => s.replace(/\/+$/, "") || "/";
  const p = clean(pattern);
  const path = clean(pathname);
  if (p === "*" || p === "/*") return { params: { "*": path.slice(1) }, score: 0 };

  const pSeg = p.split("/").filter(Boolean);
  const aSeg = path.split("/").filter(Boolean);
  const splat = pSeg[pSeg.length - 1] === "*";
  if (splat) pSeg.pop();
  if (splat ? aSeg.length < pSeg.length : aSeg.length !== pSeg.length) return null;

  const params: Record<string, string> = {};
  let score = splat ? 1 : 2;
  for (let i = 0; i < pSeg.length; i++) {
    const seg = pSeg[i]!;
    const val = aSeg[i]!;
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = decodeURIComponent(val);
      score += 2;
    } else if (seg === val) {
      score += 4;
    } else {
      return null;
    }
  }
  if (splat) params["*"] = aSeg.slice(pSeg.length).join("/");
  return { params, score };
}

export function useMatch(pattern: string) {
  const { location } = useRouter();
  return matchPath(pattern, location.pathname);
}

/* ---------- Routes / Route ---------- */

export interface RouteProps {
  path?: string;
  element?: ReactNode;
  index?: boolean;
  children?: ReactNode;
}

export function Route(_props: RouteProps): React.ReactElement | null {
  return null;
}

export function Routes({ children }: { children: ReactNode }) {
  const { location } = useRouter();

  const routes: RouteProps[] = [];
  const collect = (nodes: ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        collect((child.props as { children?: ReactNode }).children);
        return;
      }
      routes.push(child.props as RouteProps);
    });
  };
  collect(children);

  let best: { route: RouteProps; params: Record<string, string>; score: number } | null = null;
  for (const route of routes) {
    const pattern = route.index ? "/" : (route.path ?? "*");
    const m = matchPath(pattern, location.pathname);
    if (m && (!best || m.score > best.score)) best = { route, params: m.params, score: m.score };
  }

  if (!best) return null;
  return <ParamsCtx.Provider value={best.params}>{best.route.element ?? null}</ParamsCtx.Provider>;
}

export function Outlet() {
  return null;
}

/* ---------- Navigate / Link ---------- */

export function Navigate({
  to,
  replace,
  state,
}: {
  to: To;
  replace?: boolean;
  state?: unknown;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: To;
  replace?: boolean;
  state?: unknown;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, onClick, target, children, ...rest },
  ref,
) {
  const navigate = useNavigate();
  const href = typeof to === "string" ? to : `${to.pathname ?? ""}${to.search ?? ""}${to.hash ?? ""}`;
  return (
    <a
      {...rest}
      ref={ref}
      href={href}
      target={target}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          (target && target !== "_self")
        )
          return;
        e.preventDefault();
        navigate(to, { replace, state });
      }}
    >
      {children}
    </a>
  );
});

export interface NavLinkProps extends Omit<LinkProps, "className" | "style" | "children"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
  style?: React.CSSProperties | ((props: { isActive: boolean; isPending: boolean }) => React.CSSProperties);
  children?: ReactNode | ((props: { isActive: boolean; isPending: boolean }) => ReactNode);
  end?: boolean;
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { className, style, children, end, to, ...rest },
  ref,
) {
  const { location } = useRouter();
  const path = typeof to === "string" ? to.split("?")[0]! : (to.pathname ?? "/");
  const isActive = end
    ? location.pathname === path
    : location.pathname === path || location.pathname.startsWith(path.replace(/\/$/, "") + "/");
  const state = { isActive, isPending: false };
  return (
    <Link
      {...rest}
      to={to}
      ref={ref}
      className={typeof className === "function" ? className(state) : className}
      style={typeof style === "function" ? style(state) : style}
    >
      {typeof children === "function" ? children(state) : children}
    </Link>
  );
});

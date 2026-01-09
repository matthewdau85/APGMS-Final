import React from "react";
import {
  Link as RRLink,
  NavLink as RRNavLink,
  useNavigate as useRRNavigate,
  type LinkProps,
  type NavLinkProps,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { useBasePath, withBasePath } from "./basePath";

export function Link(props: LinkProps) {
  const basePath = useBasePath();
  const to = typeof props.to === "string" ? withBasePath(basePath, props.to) : props.to;
  return <RRLink {...props} to={to} />;
}

export function NavLink(props: NavLinkProps) {
  const basePath = useBasePath();
  const to = typeof props.to === "string" ? withBasePath(basePath, props.to) : props.to;
  return <RRNavLink {...props} to={to} />;
}

export function useNavigate() {
  const basePath = useBasePath();
  const nav = useRRNavigate();

  return (to: To, options?: NavigateOptions) => {
    if (typeof to === "string") return nav(withBasePath(basePath, to), options);
    return nav(to, options);
  };
}

// For everything else, continue importing directly from react-router-dom where needed (Routes, Route, Navigate, etc.)

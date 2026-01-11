import React from "react";
import { Outlet } from "react-router-dom";

import { AppProvider } from "../ux/shared/hooks/AppContext";
import Layout from "../ux/shared/components/Layout";

export function ProtoConsole() {
  return (
    <AppProvider>
      <Layout basePath="/proto">
        <Outlet />
      </Layout>
    </AppProvider>
  );
}

export default ProtoConsole;

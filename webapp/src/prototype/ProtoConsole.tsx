import React from "react";
import { Outlet } from "react-router-dom";

import { AppProvider } from "../app/context/AppContext";
import Layout from "../app/components/Layout";

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

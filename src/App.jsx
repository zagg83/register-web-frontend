import "./App.css";
import { Outlet } from "react-router-dom";
import Menu from "./ui/Menu.jsx";
import styled from "styled-components";

// App acts as the primary layout (TopNav + routed pages)
export default function App() {
  return (
    <>
      <Menu />
      <MainWrap>
        <Outlet />
      </MainWrap>
    </>
  );
}

const MainWrap = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 12px;
`;

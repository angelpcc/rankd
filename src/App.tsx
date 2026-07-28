import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import BackFab from "./components/base/BackFab";
import ViewAsBar from "./components/feature/ViewAsBar";
import InstallBanner from "./components/feature/InstallBanner";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        {/* Modo "ver como": va aquí para que la barra se vea en TODA la
            plataforma y salir esté siempre a un clic */}
        <ViewAsBar />
        <AppRoutes />
        {/* Botón de volver: solo visible cuando RANKD está instalada como app */}
        <BackFab />
        {/* Invitación a instalar: solo en móvil, si no está instalada ya */}
        <InstallBanner />
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
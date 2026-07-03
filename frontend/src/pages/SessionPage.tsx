import { useNavigate, useSearchParams } from "react-router-dom";

import { SessionLoader } from "../components/SessionLoader";

import { useSession } from "../context/SessionContext";



export function SessionPage() {

  const { setSessionReady, resetSession, reloadSession } = useSession();

  const navigate = useNavigate();

  const [params] = useSearchParams();



  const defaultYear = Number(params.get("year")) || 2025;

  const defaultRound = Number(params.get("round")) || 6;

  const defaultSessionType = params.get("session_type") || "R";

  const autoFetch = params.get("auto") === "1";



  return (

    <SessionLoader

      defaultYear={defaultYear}

      defaultRound={defaultRound}

      defaultSessionType={defaultSessionType}

      autoFetch={autoFetch}

      onBeforeLoad={resetSession}

      onLoaded={() => {

        setSessionReady(true);

        void reloadSession();

        navigate("/replay", { replace: true });

      }}

    />

  );

}


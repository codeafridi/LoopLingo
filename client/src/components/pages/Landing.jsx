import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return <button onClick={() => navigate("/auth")}>Try LoopLingo</button>;
}

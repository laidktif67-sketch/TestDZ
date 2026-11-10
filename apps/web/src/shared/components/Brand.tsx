import { Link } from "react-router-dom";

export function Brand() {
  return <Link className="brand" to="/" aria-label="TestDZ الصفحة الرئيسية"><span className="brand-mark">T</span><span>Test<span className="brand-accent">DZ</span></span></Link>;
}


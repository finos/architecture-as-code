import './Navbar.css';
import { NavLink } from 'react-router-dom';

function Navbar() {
    return (
        <div className="navbar bg-primary border-b-2 border-base-200 text-primary-content">
            <div className="navbar-start flex items-center">
                <div className="dropdown lg:hidden">
                    <div tabIndex={0} role="button" className="btn btn-ghost">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 6h16M4 12h8m-8 6h16"
                            />
                        </svg>
                    </div>
                    <ul
                        tabIndex={0}
                        className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow"
                    >
                        <li>
                            <NavLink to="/hub">Hub</NavLink>
                        </li>
                        <li>
                            <NavLink to="/visualizer">Visualizer</NavLink>
                        </li>
                    </ul>
                </div>
                <a className="btn btn-ghost text-2xl">CALM</a>
                <div className="hidden lg:flex">
                    <ul className="menu menu-horizontal px-1">
                        <li>
                            <NavLink className="btn-ghost btn text-base-100" to="/hub">
                                Hub
                            </NavLink>
                        </li>
                        <li>
                            <NavLink className="btn-ghost btn text-base-100" to="/visualizer">
                                Visualizer
                            </NavLink>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
export default Navbar;

import { ControlForm } from "../components/control-form/ControlForm.js";
import { Navbar } from "../components/navbar/Navbar.js";

export function ControlPage() {
    return (
    <>
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-4xl font-bold">Control Creator</h1>
            <ControlForm />
        </div>
    </>
    );
}
import { IoCloseOutline } from 'react-icons/io5'
import { CALMNode } from '../../types'

interface SidebarProps {
    selectedNode: CALMNode
    closeSidebar: () => void
}

function Sidebar({ selectedNode, closeSidebar }: SidebarProps) {
    return (
        <div className="drawer-side">
            <label
                htmlFor="node-details"
                className="drawer-overlay"
                onClick={closeSidebar}
            ></label>
            <div className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
                <button
                    onClick={closeSidebar}
                    className="btn btn-square ml-auto"
                >
                    <IoCloseOutline />
                </button>
                <div className="text-xl font-bold">Node</div>
                <span>unique-id: {selectedNode['unique-id']}</span>
                <span>name: {selectedNode.name}</span>
                <span>node-type: {selectedNode['node-type']}</span>
                <span>description: {selectedNode.description}</span>
            </div>
        </div>
    )
}

export default Sidebar

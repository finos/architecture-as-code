import { IoCloseOutline } from 'react-icons/io5'
import { CALMNode } from '../../types'

interface SidebarProps {
    selectedNode: { [key: string]: any };
    closeSidebar: () => void
}

function Sidebar({ selectedNode, closeSidebar }: SidebarProps) {
    const isCALMNode = selectedNode['unique-id'] !== undefined;
    console.log("This is the selectedNode => ", selectedNode)
    return (
        <div className="fixed right-0 top-0 h-full w-80 bg-gray-100 shadow-lg">
            <label
                htmlFor="node-details"
                className="drawer-overlay"
                onClick={closeSidebar}
            ></label>
            <div className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            <div className="flex justify-end">
                <button
                   onClick={(e) => {
                    e.stopPropagation()
                    closeSidebar()
                }}
                    className="btn btn-square btn-sm bg-red-500 hover:bg-red-600 text-white"
                >
                    <IoCloseOutline size={24}/>
                </button>
                </div>
                <div className="text-xl font-bold">Node Details</div>
                <div className="space-y-2">
                    <p>
                        <span className="font-semibold">unique-id:  {isCALMNode ? selectedNode['unique-id'] : selectedNode.id}</span>
                    </p>
                
                <p>
                    <span className="font-semibold">name: {selectedNode.label}</span>
                </p>
                
                <p>
                     <span className="font-semibold">node-type: {isCALMNode
              ? selectedNode['node-type']
              : selectedNode.type || 'N/A'}</span>
                </p>
               

               <p>
                <span className="font-semibold">description: {selectedNode.description}</span>
               </p>
                
                </div>
            </div>
        </div>
    )
}

export default Sidebar

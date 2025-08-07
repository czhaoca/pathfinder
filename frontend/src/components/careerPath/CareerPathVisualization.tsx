import { useEffect, useRef, useState } from 'react'
import type { 
  CareerNode, 
  CareerPathVisualization as VisualizationType 
} from '@/services/careerPathService'
import { Circle, ArrowRight, Star, MapPin } from 'lucide-react'

interface Props {
  visualization: VisualizationType
  onNodeClick?: (node: CareerNode) => void
}

export default function CareerPathVisualization({ visualization, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedPath, setSelectedPath] = useState<string[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  useEffect(() => {
    if (visualization.recommendedPath) {
      setSelectedPath(visualization.recommendedPath)
    }
  }, [visualization])

  const getNodePosition = (_nodeId: string, index: number): { x: number, y: number } => {
    const nodesPerRow = 3
    const horizontalSpacing = 250
    const verticalSpacing = 150
    
    const row = Math.floor(index / nodesPerRow)
    const col = index % nodesPerRow
    
    return {
      x: 50 + col * horizontalSpacing,
      y: 50 + row * verticalSpacing
    }
  }

  const isNodeInPath = (nodeId: string) => {
    return selectedPath.includes(nodeId)
  }

  const getTransitionPath = (from: CareerNode, to: CareerNode, fromIndex: number, toIndex: number) => {
    const fromPos = getNodePosition(from.node_id, fromIndex)
    const toPos = getNodePosition(to.node_id, toIndex)
    
    const controlPointX = (fromPos.x + toPos.x) / 2
    const controlPointY = Math.min(fromPos.y, toPos.y) - 30
    
    return `M ${fromPos.x + 100} ${fromPos.y + 40} Q ${controlPointX} ${controlPointY} ${toPos.x} ${toPos.y + 40}`
  }

  const getNodeColor = (node: CareerNode) => {
    if (node.node_id === visualization.currentPosition) return 'bg-green-500'
    if (node.node_id === visualization.targetPosition) return 'bg-blue-500'
    if (isNodeInPath(node.node_id)) return 'bg-purple-400'
    return 'bg-gray-300'
  }

  const getNodeBorderColor = (node: CareerNode) => {
    if (node.node_id === visualization.currentPosition) return 'border-green-600'
    if (node.node_id === visualization.targetPosition) return 'border-blue-600'
    if (isNodeInPath(node.node_id)) return 'border-purple-500'
    return 'border-gray-400'
  }

  return (
    <div className="relative overflow-auto" style={{ minHeight: '500px' }}>
      <div ref={canvasRef} className="relative" style={{ width: '800px', height: '500px' }}>
        {/* Draw transitions as SVG paths */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {visualization.transitions.map((transition, idx) => {
            const fromNode = visualization.nodes.find(n => n.node_id === transition.from_node_id)
            const toNode = visualization.nodes.find(n => n.node_id === transition.to_node_id)
            
            if (!fromNode || !toNode) return null
            
            const fromIndex = visualization.nodes.indexOf(fromNode)
            const toIndex = visualization.nodes.indexOf(toNode)
            const isInPath = isNodeInPath(fromNode.node_id) && isNodeInPath(toNode.node_id)
            
            return (
              <g key={idx}>
                <path
                  d={getTransitionPath(fromNode, toNode, fromIndex, toIndex)}
                  stroke={isInPath ? '#8b5cf6' : '#d1d5db'}
                  strokeWidth={isInPath ? '3' : '2'}
                  fill="none"
                  strokeDasharray={isInPath ? '0' : '5,5'}
                />
                {isInPath && (
                  <path
                    d={getTransitionPath(fromNode, toNode, fromIndex, toIndex)}
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    fill="none"
                    className="animate-pulse"
                    opacity="0.5"
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* Draw nodes */}
        {visualization.nodes.map((node, index) => {
          const position = getNodePosition(node.node_id, index)
          const isCurrentPosition = node.node_id === visualization.currentPosition
          const isTargetPosition = node.node_id === visualization.targetPosition
          
          return (
            <div
              key={node.node_id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                hoveredNode === node.node_id ? 'z-20' : 'z-10'
              }`}
              style={{ left: position.x + 100, top: position.y + 40 }}
              onMouseEnter={() => setHoveredNode(node.node_id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onNodeClick?.(node)}
            >
              <div
                className={`
                  relative px-4 py-3 rounded-lg border-2 cursor-pointer transition-all
                  ${getNodeColor(node)} ${getNodeBorderColor(node)}
                  ${hoveredNode === node.node_id ? 'scale-110 shadow-lg' : ''}
                  ${isNodeInPath(node.node_id) ? 'shadow-md' : ''}
                  text-white min-w-[200px]
                `}
              >
                {/* Position indicators */}
                {isCurrentPosition && (
                  <MapPin className="absolute -top-2 -left-2 w-6 h-6 text-green-600 bg-white rounded-full p-1" />
                )}
                {isTargetPosition && (
                  <Star className="absolute -top-2 -right-2 w-6 h-6 text-blue-600 bg-white rounded-full p-1" />
                )}
                
                <div className="text-sm font-semibold mb-1">{node.title}</div>
                <div className="text-xs opacity-90">{node.industry}</div>
                <div className="text-xs opacity-75 capitalize">{node.level} Level</div>
                
                {node.years_experience && (
                  <div className="text-xs mt-1 opacity-75">
                    {node.years_experience}+ years exp
                  </div>
                )}
              </div>

              {/* Hover tooltip */}
              {hoveredNode === node.node_id && node.description && (
                <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 w-64 p-3 bg-white rounded-lg shadow-xl border border-gray-200 z-30">
                  <div className="text-sm text-gray-700">
                    {node.description}
                  </div>
                  {node.average_salary && (
                    <div className="text-xs text-gray-500 mt-2">
                      Avg Salary: ${node.average_salary.toLocaleString()}
                    </div>
                  )}
                  {node.required_skills && node.required_skills.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-gray-600 mb-1">Key Skills:</div>
                      <div className="flex flex-wrap gap-1">
                        {node.required_skills.slice(0, 5).map((skill, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 border border-gray-200">
        <div className="text-xs font-semibold mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs">Current Position</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-xs">Target Position</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-400 rounded"></div>
            <span className="text-xs">Recommended Path</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <span className="text-xs">Other Positions</span>
          </div>
        </div>
      </div>

      {/* Path Summary */}
      {selectedPath.length > 0 && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3 border border-gray-200 max-w-xs">
          <div className="text-xs font-semibold mb-2">Recommended Path</div>
          <div className="space-y-1">
            {selectedPath.map((nodeId, idx) => {
              const node = visualization.nodes.find(n => n.node_id === nodeId)
              if (!node) return null
              
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Circle className={`w-3 h-3 ${getNodeColor(node).replace('bg-', 'text-')}`} />
                  <span className="text-xs">{node.title}</span>
                  {idx < selectedPath.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-gray-400 ml-auto" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
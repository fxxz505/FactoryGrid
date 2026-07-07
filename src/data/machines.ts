import type { BuildingDefinition } from '../models/factory'

export const buildings: BuildingDefinition[] = [
  { id: 'source-circle', name: '\u5706\u5f62\u77ff\u8109', kind: 'source', hotkey: '1', durationTicks: 12, description: '\u7a33\u5b9a\u4ea7\u51fa\u539f\u59cb\u5706\u5f62\u3002' },
  { id: 'source-square', name: '\u65b9\u5f62\u77ff\u8109', kind: 'source', hotkey: '2', durationTicks: 12, description: '\u7a33\u5b9a\u4ea7\u51fa\u539f\u59cb\u65b9\u5f62\u3002' },
  { id: 'source-star', name: '\u661f\u5f62\u77ff\u8109', kind: 'source', hotkey: '3', durationTicks: 18, description: '\u4ea7\u51fa\u540e\u671f\u76ee\u6807\u5e38\u7528\u7684\u661f\u5f62\u3002' },
  { id: 'source-diamond', name: '\u83f1\u5f62\u77ff\u8109', kind: 'source', hotkey: '4', durationTicks: 16, description: '\u4ea7\u51fa\u9ad8\u7ea7\u5806\u53e0\u4e0e\u67d3\u8272\u7528\u83f1\u5f62\u3002' },
  { id: 'belt', name: '\u4f20\u9001\u5e26', kind: 'belt', hotkey: 'B', durationTicks: 1, description: '\u6cbf\u7bad\u5934\u65b9\u5411\u9010\u683c\u8fd0\u8f93\u4e00\u4e2a\u56fe\u5f62\u3002' },
  { id: 'splitter', name: '\u5206\u6d41\u5668', kind: 'processor', hotkey: 'F', durationTicks: 1, description: '\u4ece\u80cc\u9762\u8f93\u5165\uff0c\u5728\u5de6\u53f3\u4e24\u4fa7\u51fa\u53e3\u4e4b\u95f4\u4ea4\u66ff\u5206\u6d41\u3002' },
  { id: 'merger', name: '\u5408\u6d41\u5668', kind: 'processor', hotkey: 'M', durationTicks: 1, description: '\u63a5\u6536\u591a\u8def\u8f93\u5165\u5e76\u6309\u4e00\u4e2a\u65b9\u5411\u8f93\u51fa\u3002' },
  { id: 'tunnel', name: '\u5730\u4e0b\u901a\u9053', kind: 'processor', hotkey: 'U', durationTicks: 1, description: '\u628a\u56fe\u5f62\u8df3\u8fc7\u4e24\u683c\uff0c\u7528\u6765\u8de8\u8d8a\u62e5\u6324\u7ebf\u8def\u3002' },
  { id: 'launcher', name: '\u8de8\u7ebf\u53d1\u5c04\u5668', kind: 'processor', hotkey: 'J', durationTicks: 1, description: '\u628a\u56fe\u5f62\u5411\u524d\u53d1\u5c04\u4e09\u683c\uff0c\u9002\u5408\u8de8\u8d8a\u7a7a\u5730\u3002' },
  { id: 'cutter', name: '\u5207\u5272\u673a', kind: 'processor', hotkey: 'C', durationTicks: 18, description: '\u628a\u5706\u5f62\u6216\u65b9\u5f62\u5207\u6210\u534a\u5f62\u3002' },
  { id: 'rotator', name: '\u65cb\u8f6c\u5668', kind: 'processor', hotkey: 'R', durationTicks: 14, description: '\u65cb\u8f6c\u661f\u5f62\uff0c\u5176\u4ed6\u56fe\u5f62\u76f4\u63a5\u901a\u8fc7\u3002' },
  { id: 'painter-red', name: '\u7ea2\u8272\u67d3\u8272\u5668', kind: 'processor', hotkey: 'P', durationTicks: 20, description: '\u628a\u5706\u5f62\u67d3\u6210\u7ea2\u8272\u3002' },
  { id: 'painter-blue', name: '\u84dd\u8272\u67d3\u8272\u5668', kind: 'processor', hotkey: 'L', durationTicks: 20, description: '\u628a\u65b9\u5f62\u6216\u83f1\u5f62\u67d3\u6210\u84dd\u8272\u3002' },
  { id: 'painter-green', name: '\u7eff\u8272\u67d3\u8272\u5668', kind: 'processor', hotkey: 'G', durationTicks: 20, description: '\u628a\u661f\u5f62\u67d3\u6210\u7eff\u8272\u3002' },
  { id: 'stacker', name: '\u5806\u53e0\u5668', kind: 'processor', hotkey: 'K', durationTicks: 24, description: '\u628a\u517c\u5bb9\u56fe\u5f62\u7ec4\u5408\u6210\u590d\u5408\u76ee\u6807\u3002' },
  { id: 'trash', name: '\u56de\u6536\u5668', kind: 'processor', hotkey: 'X', durationTicks: 1, description: '\u5220\u9664\u8f93\u5165\u56fe\u5f62\uff0c\u7528\u4e8e\u6e05\u7406\u5835\u585e\u3002' },
  { id: 'hub', name: '\u67a2\u7ebd', kind: 'hub', hotkey: 'H', durationTicks: 1, description: '\u63a5\u6536\u76ee\u6807\u56fe\u5f62\u5e76\u63a8\u8fdb\u4ea4\u4ed8\u8fdb\u5ea6\u3002' }
]

export const buildingById = Object.fromEntries(buildings.map((building) => [building.id, building])) as Record<string, BuildingDefinition>

var astar = require('./astar');

global.robotCount = 0; //機器人數量
global.point = []; //當前位置
global.nextPoint = []; //下個位置
global.route = []; //預定路線
global.endPoint = []; //終點位置
global.direction = []; //前進方向
global.numberPlate = []; //號碼牌
global.stepCount = []; //步數
global.changeRoute = []; //更換路徑
global.stopCount = []; //停止次數
global.robotStatus = []; //robot狀態

global.mapLength = 10;

//---graphInit---
global.x = new Array(mapLength);
for(var i = 0; i < mapLength; i++){
	x[i] = Array(mapLength).fill(1);
}
global.graph = new astar.Graph(x);
//
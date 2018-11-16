var astar = require('./astar');
var express = require('express');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var sizeof = require('object-sizeof');
var extend = require('jquery-extend');
var fs = require('fs');

server.listen(80);
console.log('Server running at port 80');

app.use(express.static('views'));

// ---varInit---
var point = new Array(); //當前位置
var nextPoint = new Array(); //下個位置
var route = new Array(); //預定路線
var endPoint = new Array(); //終點位置
var direction = new Array(); //前進方向
var number_plate = new Array(); //號碼牌
var stepCount = new Array(); //步數
var mapLength = 10;
//

//---graphInit---
var x = new Array(mapLength);
for(var i = 0; i < mapLength; i++)
	x[i] = Array(mapLength).fill(1);
var graph = new astar.Graph(x);
//

//----------------------------------function----------------------------------

/*
  位置相等判斷
  params point1 座標1
         point2 座標2
  return 是否相等
*/
function point_equal(point1, point2){
	if(point1.x == point2.x && point1.y == point2.y){
		return true;
	} else {
		return false;
	}
}

/*
  判斷前方是否有障礙物
  params index robot的index
  		 direction 前進方向
  return 是否有障礙物
*/
function haveBarrier(index, direction){
	var b = {
		x : 0,
		y : 0
	}
	switch(direction){
		case 'up' : b.y = -1; break;
		case 'down' : b.y = 1; break;
		case 'left' : b.x = -1; break;
		case 'right' : b.x = 1; break;
		default: console.log("haveBarrier function direction error"); return false;
	}
	for(let i = 0; i < point.length; i++){
		if(point[index].x + b.x == point[i].x && point[index].y + b.y == point[i].y){
			barrier = true;
		}
	}
}

/*
  尋找robot index
  params robot_ID robot編號
         socket socket連線(用於發送return_index事件)
  return index
*/
function find_index(robot_ID, socket){
	for(let i = 0; i < point.length; i++){
		if(robot_ID == point[i].id){
			socket.emit('return_index', { index : i });
			return i;
		}
	}
};

/*
  尋找路徑
  params now_X 當前X座標
         now_Y 當前Y座標
         goto_X 目的地X座標
         goto_Y 目的地Y座標
         robot_ID robot編號
         index robot的index
  return 無
  會將尋找好的路徑存進route Array中
*/
function find_route(now_X, now_Y, goto_X, goto_Y, robot_ID, index) {
	var graphLine = new astar.Graph(x);
	if(goto_X == 0){
		for(let i = 1; i < mapLength - 1; i++){
			if(i >= 3 && i <= mapLength - 4){
				for(let j = 0; j < mapLength; j+=2)
					graphLine.grid[i][j].weight = 0;
			}
		}
	}
	if(goto_X == mapLength - 1){
		for(let i = 1; i < mapLength - 1; i++){
			if(i >= 3 && i <= mapLength - 4){
				for(let j = 1; j < mapLength; j+=2)
					graphLine.grid[i][j].weight = 0;
			}
		}
	}
	var start = graphLine.grid[now_X][now_Y];
	var end = graphLine.grid[goto_X][goto_Y];
	var result = astar.astar.search(graphLine, start, end);
	var route_point = new Array();
	result.forEach(function(element) {
		route_point.push(
			{
				x : element.x,
				y : element.y
			}
		);
	});
	var exist = true;
	for(let i = 0 ; i < route.length; i++){
	  	if(route[i].id == robot_ID){
	  	    route[i].route_point = route_point;
	  	    exist = false;
	  	    break;
	  	}
	}
	if(exist){
	  	route.push(
	  		{
	  			id : robot_ID,
	  			route_point : route_point
	  		}
	  	);
	}
};

/*
  重新尋找路徑(因原路徑上有區域賭塞)
  params now_X 當前X座標
         now_Y 當前Y座標
         goto_X 目的地X座標
         goto_Y 目的地Y座標
         index robot的index
         lock 賭塞的區域(將此區域鎖住後來尋找路徑)
  return 無
  會將尋找好的路徑存進route Array中
*/
function re_find_route(now_X, now_Y, goto_X, goto_Y, index, lock) {
	var graphLine = new astar.Graph(x);
	if(goto_X == 0){
		for(let i = 1; i < mapLength - 1; i++){
			if(i >= 3 && i <= mapLength - 4){
				for(let j = 0; j < mapLength; j+=2)
					graphLine.grid[i][j].weight = 0;
			}
		}
	}
	if(goto_X == mapLength - 1){
		for(let i = 1; i < mapLength - 1; i++){
			if(i >= 3 && i <= mapLength - 4){
				for(let j = 1; j < mapLength; j+=2)
					graphLine.grid[i][j].weight = 0;
			}
		}
	}
	for(let i = 0; i < lock.length; i++){
		graphLine.grid[lock[i].x][lock[i].y] = 0;
	}
	io.emit("console",{graph : graphLine});
	var start = graphLine.grid[now_X][now_Y];
	var end = graphLine.grid[goto_X][goto_Y];
	var result = astar.astar.search(graphLine, start, end);
	var route_point = new Array();
	result.forEach(function(element) {
		route_point.push(
			{
				x : element.x,
				y : element.y
			}
		);
	});
	if(route_point.length > 0){
		route[index].route_point = route_point;
	}
};

/*
  抽號碼牌
  params index robot的index
  return 無
  會將抽出的號碼牌存進number_plate Array中
*/
function drawNumberPlate(index){
	var exist = false;
	//已抽過號碼牌不再抽取
	for(let i = 0; i < number_plate.length; i++){
		if(point_equal(number_plate[i], route[index].route_point[0]) && number_plate[i].index == index){
			exist = true;
		}
	}
	if(!exist){
		number_plate.push(
			{
				x : route[index].route_point[0].x,
				y : route[index].route_point[0].y,
				index : index
			}
		);
	}
	if(route[index].route_point.length > 1){
		exist = false;
		for(let i = 0; i < number_plate.length; i++){
			if(point_equal(number_plate[i], route[index].route_point[1]) && number_plate[i].index == index){
				exist = true;
			}
		}
		if(!exist){
			number_plate.push(
				{
					x : route[index].route_point[1].x,
					y : route[index].route_point[1].y,
					index : index
				}
			);
		}
	}
};

/*
  使用號碼牌
  params index robot的index
  		 x 此號碼牌的X座標
  		 y 此號碼牌的Y座標
  return 無
  會將使用的號碼牌從number_plate Array中移除
*/
function useNumberPlate(index, x, y){
	if(point[index].x != x || point[index].y != y){
		for(let i = 0; i < number_plate.length; i++){
			if(number_plate[i].index == index && number_plate[i].x == x && number_plate[i].y == y)
				number_plate.splice(i, 1);
		}
	}
}

/*
  丟棄號碼牌(因路徑轉換而捨棄原本的號碼牌)
  params index robot的index
  		 x 此號碼牌的X座標
  		 y 此號碼牌的Y座標
  return 無
  會將丟棄的號碼牌從number_plate Array中移除
*/
function throwNumberPlate(index, x, y){
	for(let i = 0; i < number_plate.length; i++){
		if(number_plate[i].index == index && number_plate[i].x == x && number_plate[i].y == y){
			number_plate.splice(i, 1);
		}
	}
}

/*
  判斷robot前進方向
  params index robot的index
  return 前進方向
*/
function trunWhere(index){
	if(point[index].x == route[index].route_point[0].x){
		if(point[index].y - route[index].route_point[0].y == 0)
			return "stop";
		return point[index].y - route[index].route_point[0].y > 0 ? "up" : "down";
	}
	else if(point[index].y == route[index].route_point[0].y){
		return point[index].x - route[index].route_point[0].x > 0 ? "left" : "right";
	}
}

/*
  判斷前方是否塞車
  params index robot的index
  return 是否塞車
*/
function isTrafficCongestion(index){
	var lock = new Array();
	var count = 0;
	var xe = point[index].x;
	var ye = point[index].y;
	switch(trunWhere(index)){
		//向下前進時
		case "down":
			direction[index] = 'down';
			//當位置不在最左或最右，且下方還>=3格
			if(xe > 0 && xe < mapLength - 1 && ye < mapLength - 3){
				for(let i = xe - 1; i <= xe + 1; i++){
					for(let j = ye + 1; j <= ye + 3; j++){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最左時，且下方還>=3格
			else if(xe == 0 && ye < mapLength - 3){
				for(let i = xe; i <= xe + 1; i++){
					for(let j = ye + 1; j <= ye + 3; j++){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最右時，且下方還>=3格
			else if(xe == mapLength - 1 && ye < mapLength - 3){
				for(let i = xe; i >= xe - 1; i--){
					for(let j = ye + 1; j <= ye + 3; j++){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			break;

		//向上前進時
		case "up":
			direction[index] = 'up';
			//當位置不在最左或最右時，且上方還>=3格
			if(xe > 0 && xe < mapLength - 1 && ye > 2){
				for(let i = xe - 1; i <= xe + 1; i++){
					for(let j = ye - 1; j >= ye - 3; j--){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最左時，且上方還>=3格
			else if(xe == 0 && ye > 2){
				for(let i = xe; i <= xe + 1; i++){
					for(let j = ye - 1; j >= ye - 3; j--){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最右時，且上方還>=3格
			else if(xe == mapLength - 1 && ye > 2){
				for(let i = xe; i >= xe - 1; i--){
					for(let j = ye - 1; j >= ye - 3; j--){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			break;

		//向左前進時
		case "left":
			direction[index] = 'left';
			//當位置不在最上或最下時，且左方還>=3格
			if(xe > 2 && ye > 0 && ye < mapLength - 1){
				for(let i = xe - 1; i >= xe - 3; i--){
					for(let j = ye - 1; j <= ye + 1; j++){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最左時，且上方還>=3格
			else if(xe > 2 && ye == 0){
				for(let i = xe - 1; i >= xe - 3; i--){
					for(let j = ye; j <= ye + 1; j++){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最右時，且上方還>=3格
			else if(xe > 2 && ye < mapLength - 1){
				for(let i = xe - 1; i >= xe - 3; i--){
					for(let j = ye; j >= ye - 1; j--){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			break;

		//向右前進時
		case "right":
			direction[index] = 'right';
			//當位置不在最上或最下時，且右方還>=3格
			if(xe < mapLength - 3 && ye > 0 && ye < mapLength - 1){
				for(let i = xe + 1; i <= xe + 3; i++){
					for(let j = ye - 1; j <= ye + 1; j++){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最上時，且右方還>=3格
			else if(xe < mapLength - 3 && ye == 0){
				for(let i = xe + 1; i <= xe + 3; i++){
					for(let j = ye; j <= ye + 1; j++){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			//當位置在最下時，且右方還>=3格
			else if(xe < mapLength - 3 && ye == mapLength - 1){
				for(let i = xe + 1; i <= xe + 3; i++){
					for(let j = ye; j >= ye - 1; j--){
						lock.push(
							{
								x : i,
								y : j
							}
						);
						for(let z = 0; z < point.length; z++){
							if(point[z].x == i && point[z].y == j){
								count++;
							}
						}
					}
				}
			}
			break;

		default: break;
	}
	if(count > 2){
		return lock;
	} else {
		return null;
	}
}

/*
  robot前進下一步
  params robot_ID robot編號
         index robot的index
         socket socket連線(用於發送事件)
  return 無
  判斷此robot是否需要停下、改道，若不需要就讓robot繼續前進
*/
function next(robot_ID, index, socket) {
	var stop = false;

	var lock = isTrafficCongestion(index);
	if(lock != null){
		throwNumberPlate(index, route[index].route_point[0].x, route[index].route_point[0].y);
		re_find_route(point[index].x, point[index].y, route[index].route_point[route[index].route_point.length - 1].x, route[index].route_point[route[index].route_point.length - 1].y, index, lock)
		stop = true;
	}
	console.log(direction);
	if(!stop){
		for(let i = 0; i < point.length; i++){
			//在同一行或同一列時才判斷是否對撞---!
			if(i != index && (point[i].x == point[index].x || point[i].y == point[index].y)){
				//判斷是否對撞
				if(point[index].x == route[i].route_point[0].x && point[index].y == route[i].route_point[0].y && point[i].x == route[index].route_point[0].x && point[i].y == route[index].route_point[0].y){
					throwNumberPlate(index, route[index].route_point[0].x, route[index].route_point[0].y);
					//上下準備對撞時，判斷上邊的robot位置，位置在前2行或倒數第3行，往右方繞路
					if(point[index].x == route[index].route_point[0].x && point[index].x <= 1 && point[index].y < point[i].y || point[index].x == route[index].route_point[0].x && point[index].x == mapLength - 3 && point[index].y < point[i].y){
						//判斷上方robot的右方是否有障礙物
						if(!haveBarrier(index, 'right')){
							if(route[index].route_point.length > 1 && route[index].route_point[1].x == point[index].x + 1 && route[index].route_point[1].y == point[index].y + 1){
								route[index].route_point.shift();
							} else {
								route[index].route_point.unshift(
									{
										x : point[index].x + 1,
										y : point[index].y + 1
									}
								)
							}
							// 00 01 11 原本路徑
							// 00 10 11 01 11正常變更
							// 00 10 11 新的變更
							route[index].route_point.unshift(
								{
									x : point[index].x + 1,
									y : point[index].y
								}
							);
						//若上邊robot的右方有阻礙，則由下方robot往右方繞路
						} else {
							if(route[i].route_point.length > 1 && route[i].route_point[1].x == point[i].x + 1 && route[i].route_point[1].y == point[i].y + 1){
								route[i].route_point.shift();
							} else {
								route[i].route_point.unshift(
									{
										x : point[i].x + 1,
										y : point[i].y + 1
									}
								)
							}
							route[i].route_point.unshift(
								{
									x : point[i].x + 1,
									y : point[i].y
								}
							);
						}
					}
					//上下準備對撞時，判斷下邊的robot位置，位置在第3行或倒數前2行，往左方繞路
					else if(point[index].x == route[index].route_point[0].x && point[index].x == 2 && point[index].y > point[i].y || point[index].x == route[index].route_point[0].x && point[index].x >= mapLength - 2 && point[index].y > point[i].y){
						//判斷下方robot的左方是否有障礙物
						if(!haveBarrier(index, 'left')){
							if(route[index].route_point.length > 1 && route[index].route_point[1].x == point[index].x - 1 && route[index].route_point[1].y == point[index].y - 1){
								route[index].route_point.shift();
							} else {
								route[index].route_point.unshift(
									{
										x : point[index].x - 1,
										y : point[index].y - 1
									}
								)
							}
							route[index].route_point.unshift(
								{
									x : point[index].x - 1,
									y : point[index].y
								}
							);
						//若下方robot的左方有阻礙，則由上方robot往左方繞路
						} else {
							if(route[i].route_point.length > 1 && route[i].route_point[1].x == point[i].x - 1 && route[i].route_point[1].y == point[i].y - 1){
								route[i].route_point.shift();
							} else {
								route[i].route_point.unshift(
									{
										x : point[i].x - 1,
										y : point[i].y - 1
									}
								)
							}
							route[i].route_point.unshift(
								{
									x : point[i].x - 1,
									y : point[i].y
								}
							);
						}
					}
					//左右準備對撞時，判斷左邊的robot位置，位置在前5列時，往下方繞路
					else if(point[index].y == route[index].route_point[0].y && point[index].y <= 4 && point[index].x < point[i].x){
						if(route[index].route_point.length > 1 && route[index].route_point[1].x == point[index].x + 1 && route[index].route_point[1].y == point[index].y + 1){
							route[index].route_point.shift();
						} else {
							route[index].route_point.unshift(
								{
									x : point[index].x + 1,
									y : point[index].y + 1
								}
							)
						}
						route[index].route_point.unshift(
							{
								x : point[index].x,
								y : point[index].y + 1
							}
						);
					}
					//左右準備對撞時，判斷右邊的robot位置，位置在後5列時，往上方繞路
					else if(point[index].y == route[index].route_point[0].y && point[index].y >= 5 && point[index].x > point[i].x){
						if(route[index].route_point.length > 1 && route[index].route_point[1].x == point[index].x - 1 && route[index].route_point[1].y == point[index].y - 1){
							route[index].route_point.shift();
						} else {
							route[index].route_point.unshift(
								{
									x : point[index].x - 1,
									y : point[index].y - 1
								}
							)
						}
						route[index].route_point.unshift(
							{
								x : point[index].x,
								y : point[index].y - 1
							}
						);
					}
				}
			}
		}
	}
	if(!stop){
		drawNumberPlate(index);
		for(let i = 0; i < number_plate.length; i++){
			if(route[index].route_point[0].x == number_plate[i].x && route[index].route_point[0].y == number_plate[i].y){
				//若即將前往的格子的優先權不屬於自己，則先停止前進
				if(number_plate[i].index != index){
					stop = true;
				}
				break;
			}
		}
	}
	if(stop){
		socket.emit('stop');
	}
	else{
	    socket.emit('go',
	    	{
	    		x : route[index].route_point[0].x,
	    		y : route[index].route_point[0].y
	    	}
	    );
	    nextPoint[index] = {
	    	x : route[index].route_point[0].x,
	    	y : route[index].route_point[0].y,
	    	id : robot_ID
	    };
	    io.emit('draw',{ point : point, nextPoint : nextPoint });
	}
};
//----------------------------------function End----------------------------------

//webroute start
app.get('/', function (req, res) {
    res.render('test.ejs');
});

app.get('/line', function (req, res) {
    res.render('line.ejs');
});

app.get('/home', function (req, res) {
    res.render('home.ejs');
});

app.get('/testJson', function (req, res) {
    res.json(JSON.parse(fs.readFileSync("test.json")));
});
//webroute end

//socket connect start
io.on('connection', function (socket) {
    console.log("connect connectCount : " + io.engine.clientsCount);

    //connectionEvent setADDress
    socket.on('setAddress', function (data){
		point[data.index] = {
			x : data.now_x,
			y : data.now_y,
			id : data.id
		};
		useNumberPlate(data.index, data.previous_x, data.previous_y);
  		io.emit('draw',{ point : point, nextPoint : nextPoint });
  	});

  	//connectionEvent set
  	socket.on('initSet', function (data) {
  		if (io.sockets.connected[socket.id]) {
	  		var exist = false; //此robot是否存在於當前point Array
	  		for(let i = 0; i < point.length; i++){
	  			if(point[i].id == data.id){
	  	  			point[i] = {
	  	  				x : data.now_x,
	  	  				y : data.now_y,
	  	  				id : data.id
	  	  			};
	  	 			exist = true;
	  	  			break;
	  			}
	  		}
	  		//當robot不存在時，新增資料進point Array
	  		if(!exist){
	  			point.push(
	  				{
	  					x : data.now_x,
	  					y : data.now_y,
	  					id : data.id
	  				}
	  			);
	  		}
	  		io.emit('draw',{ point : point, nextPoint : nextPoint });
	  		var index = find_index(data.id, socket);
  			if(isNaN(stepCount[index])){
  				stepCount[index] = 0
  			}
  		}
  	});

    //connectionEvent start
  	socket.on('start', function (data) {
  		var exist = false; //此robot是否存在於當前endPoint Array
  		for(let i = 0; i < endPoint.length; i++){
  			if(endPoint[i].id == data.id){
  	  			endPoint[i] = {
  	  				x : data.now_x,
  	  				y : data.now_y,
  	  				id : data.id
  	  			};
  	 			exist = true;
  	  			break;
  			}
  		}
  		//當robot不存在時，新增資料進endPoint Array
  		if(!exist){
  			endPoint.push(
  				{
  					x : data.now_x,
  					y : data.now_y,
  					id : data.id
  				}
  			);
  		}
  		find_route(point[data.index].x, point[data.index].y, data.goto_x, data.goto_y, data.id, data.index);
  		next(data.id, data.index, socket);
  	});

  	//connectionEvent walk
  	socket.on('walk', function (data) {
		if(point[data.index].x == route[data.index].route_point[0].x && point[data.index].y == route[data.index].route_point[0].y){
			route[data.index].route_point.shift();
			next(data.id, data.index, socket);
		}
		else{
			next(data.id, data.index, socket);
		}
		if(!data.isStop){
			stepCount[data.index]++;
		}
  	});

  	socket.on('disconnect', function() { console.log("disconnect connectCount : " + io.engine.clientsCount) });
});
//socket connect end

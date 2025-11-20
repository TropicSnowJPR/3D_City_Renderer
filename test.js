// 平常应该使用CatmullRomCurve3绘制曲线或者使用贝塞尔三维进行绘制曲线

import * as THREE from "https://esm.sh/three";
import { OrbitControls } from "https://esm.sh/three/examples/jsm/controls/OrbitControls";
import * as SceneUtils from 'https://esm.sh/three/examples/jsm/utils/SceneUtils.js';
let clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set( 0, 1, 3 );
const renderer = new THREE.WebGLRenderer( { antialias: true,

            alpha: true,
            logarithmicDepthBuffer: true,
            precision: "highp",stencil: true } );
renderer.sortObjects = true;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0xFFFFFF, 0.0);
        renderer.autoClearStencil = false;
// const renderTarget = new RenderTarget(width, height, {stencilBuffer:true});
// const composer = new EffectComposer(renderer, renderTarget);
// https://discourse.threejs.org/t/does-post-processing-conflict-with-stencil-test/41911/2
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
const controls = new  OrbitControls( camera, renderer.domElement );


const light = new THREE.DirectionalLight( 0xc0c0c0 );
light.position.set( - 8, 12, 10 );
light.intensity = 1.0;
scene.add( light );

const light1 = new THREE.AmbientLight( 0x404040 ); // soft white light
scene.add( light1 );

const geometry = new THREE.BoxGeometry( 1, 0.8, 1 );
// MeshPhongMaterial
const material = new THREE.MeshBasicMaterial( { color: 0x99ffff, wireframe: false } );
const objectToCurve = new THREE.Mesh( geometry, material );
let meshs = new THREE.Group();
meshs.add(objectToCurve);
scene.add(meshs);

const plane = new THREE.PlaneGeometry();
const planeMesh = new THREE.Mesh(plane, [material,material])
planeMesh.geometry.clearGroups();
planeMesh.geometry.addGroup(0, Infinity, 0);
planeMesh.geometry.addGroup(0, Infinity, 1);

planeMesh.position.set(0,1,0);
meshs.add(planeMesh)
// scene.add(planeMesh);

const tgeometry = new THREE.SphereGeometry( 0.8, 32, 32 );
var front = new THREE.MeshBasicMaterial();
front.depthWrite = false;
front.depthTest = true;
front.colorWrite = false;
front.stencilWrite = true;

front.stencilFunc = THREE.AlwaysStencilFunc;
front.side = THREE.FrontSide;
front.stencilFail = THREE.KeepStencilOp;
front.stencilZFail = THREE.KeepStencilOp;
front.stencilZPass = THREE.IncrementWrapStencilOp;


var back = new THREE.MeshBasicMaterial();
back.depthWrite = false;

back.colorWrite = false;
back.stencilWrite = true;
back.stencilFunc = THREE.AlwaysStencilFunc;
back.side = THREE.BackSide ;
back.stencilFail = THREE.KeepStencilOp;
back.stencilZFail = THREE.KeepStencilOp;
back.stencilZPass = THREE.DecrementWrapStencilOp;



var intersect = new THREE.MeshBasicMaterial({});
intersect.depthWrite = false;
intersect.depthTest = false;
intersect.colorWrite = true;
intersect.stencilWrite = true;
// intersect.transparent= true;
intersect.color.set(0xff8766);

intersect.stencilFunc = THREE.NotEqualStencilFunc;
intersect.stencilFail = THREE.ReplaceStencilOp;
intersect.stencilZFail = THREE.ReplaceStencilOp;
intersect.stencilZPass = THREE.ReplaceStencilOp;





const materials = [ front,back, intersect];
const intersectionGroup = SceneUtils.createMultiMaterialObject( tgeometry, materials );

intersectionGroup.position.set(1,0.6,0);


scene.add(intersectionGroup);

const randomPoints = [];

randomPoints.push( new THREE.Vector3( - 60, 0, 0 ) );
randomPoints.push( new THREE.Vector3( 0, 0, 60 ) );
randomPoints.push( new THREE.Vector3( 60, 0, 0 ) );
randomPoints.push( new THREE.Vector3( 100, 0, 80 ) );
const randomSpline = new THREE.CatmullRomCurve3( randomPoints );
const extrudeSettings2 = {
					steps: 100,
					bevelEnabled: false,
					extrudePath: randomSpline
				};



const width = 10;

const squareShape = new THREE.Shape()
.moveTo( 0, 0 )
.lineTo( 0, width )
.lineTo( 80, width )
.lineTo( 80, 0 )
.lineTo( 0, 0 );
                
let list=[new THREE.Vector2(1,1),
          new THREE.Vector2(3,1),
          new THREE.Vector2(3,3),
          new THREE.Vector2(1,3),
          new THREE.Vector2(1,1),
         ];
let geometry_test = new THREE.ExtrudeGeometry( new THREE.Shape( list ), { depth: 1,bevelEnabled: false } )
// { depth: 1, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 1, bevelThickness: 1 }


const geometry2 = new THREE.ExtrudeGeometry( squareShape, extrudeSettings2 );

const material2 = new THREE.MeshLambertMaterial( { color: 0xff0000, wireframe: false });

const mesh2 = new THREE.Mesh( geometry2, material2 );

let mesh_test = new THREE.Mesh(geometry_test, material2);
// scene.add(mesh_test);
// scene.add(mesh2);
mesh2.scale.set(0.01,0.01,0.01);
mesh2.position.set(1,1,0);
mesh2.lookAt(0,0,0);
let rot = 0

// const plane3 = new THREE.PlaneGeometry();
//   const planeMesh3 = new THREE.Mesh(plane3, material)
//   planeMesh3.position.set(1, 0, 0);
// planeMesh.add(planeMesh3)

planeMesh.isMesh =true;
scene.add(planeMesh.clone())
let pos=1;
let cur = planeMesh
document.addEventListener("click", function(){
  const plane3 = new THREE.PlaneGeometry();
  const planeMesh3 = new THREE.Mesh(plane3, material)
  planeMesh3.position.set(0.2, 0, 0);
  planeMesh3.updateMatrix();
		planeMesh3.updateMatrixWorld(true);
  // planeMesh3.geometry.addGroup(0, Infinity, 0);
  // planeMesh3.position.set(pos =pos==1?0:1, 1, 0);
  console.log(planeMesh)
  cur.isMesh= false;
  cur.add(planeMesh3)
  cur = planeMesh3

});

animate();

function animate( ) {
  let time = clock.getElapsedTime();
  // rot+=0.00001;
  

	requestAnimationFrame( animate );
	renderer.render( scene, camera );

}
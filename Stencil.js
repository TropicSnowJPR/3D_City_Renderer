
// // =-= Stencil =-= //
// const renderFloorGeometry = new THREE.BoxGeometry((2 * radius + 0.05), 1, (2 * radius + 0.05));// MeshPhongMaterial
// const renderFloorMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: false, colorWrite: false});
// const renderFloor = new THREE.Mesh(renderFloorGeometry, renderFloorMaterial);
// renderFloorMesh = new THREE.Group();
// renderFloorMesh.add(renderFloor);
// renderFloorMesh.position.set(0, 0.5, 0)
// scene.add(renderFloorMesh);
//
// const stencilizedArea = new THREE.CylinderGeometry(radius, radius, 40, 128);
//
// var frontMaterial = new THREE.MeshBasicMaterial({  wireframe: false });
// frontMaterial.depthWrite = false;
// frontMaterial.depthTest = true;
// frontMaterial.colorWrite = false;
// frontMaterial.stencilWrite = true;
// frontMaterial.stencilFunc = THREE.AlwaysStencilFunc;
// frontMaterial.side = THREE.FrontSide;
// frontMaterial.stencilFail = THREE.KeepStencilOp;
// frontMaterial.stencilZFail = THREE.KeepStencilOp;
// frontMaterial.stencilZPass = THREE.IncrementWrapStencilOp;
//
// var backMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// backMaterial.depthWrite = false;
// backMaterial.colorWrite = false;
// backMaterial.stencilWrite = true;
// backMaterial.stencilFunc = THREE.AlwaysStencilFunc;
// backMaterial.side = THREE.BackSide ;
// backMaterial.stencilFail = THREE.KeepStencilOp;
// backMaterial.stencilZFail = THREE.KeepStencilOp;
// backMaterial.stencilZPass = THREE.DecrementWrapStencilOp;
//
// var intersectMaterial = new THREE.MeshBasicMaterial({ wireframe: false}); //Circle in middle
// intersectMaterial.depthWrite = false;
// intersectMaterial.depthTest = false;
// intersectMaterial.colorWrite = true;
// intersectMaterial.stencilWrite = true;
// intersectMaterial.color.set(0xfec365);
//
// intersectMaterial.stencilFunc = THREE.NotEqualStencilFunc;
// intersectMaterial.stencilFail = THREE.ReplaceStencilOp;
// intersectMaterial.stencilZFail = THREE.ReplaceStencilOp;
// intersectMaterial.stencilZPass = THREE.ReplaceStencilOp;
//
// const materials = [ frontMaterial, backMaterial, intersectMaterial ];
// const intersectionGroup = SceneUtils.createMultiMaterialObject( stencilizedArea, materials );
// intersectionGroup.position.set(0,1,0);
// scene.add(intersectionGroup);
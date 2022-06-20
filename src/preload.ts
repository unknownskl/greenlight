console.log('Preload script ready');

window.addEventListener('load', function() {
  // Load font because it is missing from the system fonts on linux
  var linkElement = document.createElement('link');
  linkElement.href = 'https://fonts.googleapis.com/css2?family=Roboto&display=swap;'
  linkElement.rel = 'stylesheet';
  document.head.append(linkElement);
});

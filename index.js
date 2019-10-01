const AWS = require('aws-sdk');
const DateDiff = require('date-diff');

AWS.config.loadFromPath('./config.json');

var today = new Date();

var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});

function main(){
    var instanceParams = {
        //Will get all instances
        IncludeAllInstances: true
     };
    ec2.describeInstanceStatus(instanceParams,function(err, data){
        if(err){
            console.log(err.message);
        }
        else
            for(var index in data['InstanceStatuses']){
                var  instance =  data['InstanceStatuses'][index];
                //Only contemplates instances that are running
                if(instance.InstanceState.Name=='running'){
                    var params = {
                        Filters: [
                           {
                          Name: "resource-id", 
                          Values: [
                             instance.InstanceId
                          ]
                         }
                        ]
                    };
                    //For every running instance that it finds it gets the corresponding tags
                    ec2.describeTags(params, function(err, tag_data) {
                        if (err) console.log(err.message);
                        else  
                            //Double loop to get to the tag info (ther might be a beter way to do this)
                            for(var e in tag_data){
                                for (var i in tag_data[e]){
                                    //If it finds the tag 'Retention' then it saves the retetion period
                                    if(tag_data[e][i].Key == 'Retention'){
                                        //If Retention period of a image is grater then the specified then:
                                            //Images of that instance are deregistered in the Backup_checker
                                        Backups_checker(tag_data[e][i].ResourceId,tag_data[e][i].Value);
                                    }
                                    //If it finds the tag 'Backup' with the value of true then a AMI is created with the following name
                                    //instance.id+"-"+date_time.today(in miliseconds)
                                    if(tag_data[e][i].Key == 'Backup' && tag_data[e][i].Value == 'true'){
                                        console.log('Creating AMI for the instance: '+tag_data[e][i].ResourceId);
                                        create_image(tag_data[e][i].ResourceId,Date.now());
                                    }  
                                }
                            }
                    });
                }
                else
                    console.log("WARNING - "+instance.InstanceId+" DOWN\n");
            }
    }) ; 
}

function Backups_checker(instance,retention_period){
    var params = {
        Filters:[{
            Name:'tag:instance',
            Values:[instance]
        }]
    };

    ec2.describeImages(params,function(err,data){
        if(err){
            console.log(err.message);
        }
        else
            if(data.Images.length != 0){
                for(var e in data.Images){
                    var creation_date = new Date(data.Images[e].CreationDate);
                    var diference = new DateDiff(today,creation_date);
                    var AMI_ID = data.Images[e].ImageId;
                    if(diference > retention_period){
                        console.log("INFO - AMI|"+AMI_ID+" |Instance "+instance+"| Creation Day "+diference.days());
                        deregister_image(data.Images[e].ImageId);
                    }
                    else
                        console.log("INFO - AMI|"+AMI_ID+" |Instance "+instance+"| Creation Day "+diference.days());
                }
            }
    });
}

function create_image(instance,today){
    var params = {
        InstanceId: instance,
        Name: instance+'-'+today,
        NoReboot: true,
        Description: 'Instance: '+instance
    };
    ec2.createImage(params,function(err,data){
        if(err){
            console.log(err.message);
        }
        else
            console.log(data);
    });
}
function deregister_image(image){
    console.log('Deregistering AMI: '+image);
    var params = {
        ImageId: image, 
        
      };
      ec2.deregisterImage(params, function(err, data) {
        if (err) console.log(err.message);
        else     console.log(data);
      });
}
main()
